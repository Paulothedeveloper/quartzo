// Gerador de DOCX (OOXML) nativo — sem ferramentas externas. Converte Markdown
// (já "achatado") num .docx que Word/LibreOffice abrem. Cobre títulos, ênfases,
// código, citações, listas, tabelas, regras, links e imagens embutidas.
use std::collections::HashSet;
use std::io::Write;
use std::path::{Path, PathBuf};

use pulldown_cmark::{Alignment, Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use zip::write::SimpleFileOptions;

fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[derive(Default, Clone)]
struct Fmt {
    b: bool,
    i: bool,
    strike: bool,
    code: bool,
    link: bool,
}

fn run(text: &str, f: &Fmt) -> String {
    if text.is_empty() {
        return String::new();
    }
    let mut rpr = String::new();
    if f.b {
        rpr.push_str("<w:b/>");
    }
    if f.i {
        rpr.push_str("<w:i/>");
    }
    if f.strike {
        rpr.push_str("<w:strike/>");
    }
    if f.code {
        rpr.push_str("<w:rFonts w:ascii=\"Consolas\" w:hAnsi=\"Consolas\"/><w:shd w:val=\"clear\" w:fill=\"EEF2F7\"/>");
    }
    if f.link {
        rpr.push_str("<w:color w:val=\"0E7490\"/><w:u w:val=\"single\"/>");
    }
    let rpr = if rpr.is_empty() {
        String::new()
    } else {
        format!("<w:rPr>{rpr}</w:rPr>")
    };
    format!("<w:r>{rpr}<w:t xml:space=\"preserve\">{}</w:t></w:r>", esc(text))
}

/// Dimensões (px) de PNG/JPEG/GIF; fallback 600×400.
fn image_dims(b: &[u8]) -> (u32, u32) {
    if b.len() > 24 && &b[0..8] == b"\x89PNG\r\n\x1a\n" {
        let w = u32::from_be_bytes([b[16], b[17], b[18], b[19]]);
        let h = u32::from_be_bytes([b[20], b[21], b[22], b[23]]);
        return (w.max(1), h.max(1));
    }
    if b.len() > 10 && (&b[0..6] == b"GIF87a" || &b[0..6] == b"GIF89a") {
        let w = u16::from_le_bytes([b[6], b[7]]) as u32;
        let h = u16::from_le_bytes([b[8], b[9]]) as u32;
        return (w.max(1), h.max(1));
    }
    if b.len() > 4 && b[0] == 0xFF && b[1] == 0xD8 {
        let mut i = 2usize;
        while i + 9 < b.len() {
            if b[i] != 0xFF {
                i += 1;
                continue;
            }
            let m = b[i + 1];
            let is_sof = (0xC0..=0xCF).contains(&m) && m != 0xC4 && m != 0xC8 && m != 0xCC;
            if is_sof {
                let h = u16::from_be_bytes([b[i + 5], b[i + 6]]) as u32;
                let w = u16::from_be_bytes([b[i + 7], b[i + 8]]) as u32;
                return (w.max(1), h.max(1));
            }
            if i + 3 >= b.len() {
                break;
            }
            let len = u16::from_be_bytes([b[i + 2], b[i + 3]]) as usize;
            i += 2 + len;
        }
    }
    (600, 400)
}

struct Builder {
    body: String,
    rels: String,
    media: Vec<(String, Vec<u8>)>,
    exts: HashSet<String>,
    rid: u32,
    base_dirs: Vec<PathBuf>,
}

impl Builder {
    fn resolve_image(&self, url: &str) -> Option<PathBuf> {
        let u = url.split('#').next().unwrap_or(url);
        let u = percent_decode(u);
        let direct = Path::new(&u);
        if direct.is_absolute() && direct.exists() {
            return Some(direct.to_path_buf());
        }
        for d in &self.base_dirs {
            let p = d.join(&u);
            if p.exists() {
                return Some(p);
            }
        }
        None
    }

    fn add_image(&mut self, url: &str, alt: &str) -> String {
        let Some(path) = self.resolve_image(url) else {
            // imagem não achada → mostra o texto alternativo
            return format!("<w:p>{}</w:p>", run(if alt.is_empty() { url } else { alt }, &Fmt::default()));
        };
        let Ok(bytes) = std::fs::read(&path) else {
            return format!("<w:p>{}</w:p>", run(alt, &Fmt::default()));
        };
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("png")
            .to_lowercase();
        let ext = if ext == "jpeg" { "jpg".to_string() } else { ext };
        self.exts.insert(ext.clone());
        self.rid += 1;
        let rid = self.rid;
        let fname = format!("image{rid}.{ext}");
        let (pw, ph) = image_dims(&bytes);
        // EMU: 9525 por px (96dpi). Largura máx ~6in.
        let max_w: u64 = 5_486_400;
        let mut cx = pw as u64 * 9525;
        let mut cy = ph as u64 * 9525;
        if cx > max_w {
            cy = cy * max_w / cx;
            cx = max_w;
        }
        self.media.push((fname.clone(), bytes));
        self.rels.push_str(&format!(
            "<Relationship Id=\"rId{rid}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"media/{fname}\"/>"
        ));
        format!(
            "<w:p><w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\"><wp:extent cx=\"{cx}\" cy=\"{cy}\"/><wp:docPr id=\"{rid}\" name=\"{}\"/><a:graphic xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\"><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:pic xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:nvPicPr><pic:cNvPr id=\"{rid}\" name=\"{}\"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed=\"rId{rid}\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"{cx}\" cy=\"{cy}\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>",
            esc(alt), esc(alt)
        )
    }
}

/// Converte markdown → arquivo .docx em `dest`. `base_dirs` = pastas onde procurar imagens.
pub fn write_docx(md: &str, base_dirs: Vec<PathBuf>, dest: &Path) -> Result<(), String> {
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    let parser = Parser::new_ext(md, opts);

    let mut b = Builder {
        body: String::new(),
        rels: String::new(),
        media: Vec::new(),
        exts: HashSet::new(),
        rid: 0,
        base_dirs,
    };

    // estado de parágrafo / inline
    let mut runs = String::new();
    let mut fmt = Fmt::default();
    let mut heading: Option<u8> = None;
    let mut in_quote = false;
    let mut list_stack: Vec<(bool, u64)> = Vec::new(); // (ordenada?, próximo índice)
    let mut code_block: Option<String> = None;
    let mut link_alt = String::new();

    // tabela
    let mut in_table = false;
    let mut aligns: Vec<Alignment> = Vec::new();
    let mut tbl = String::new();
    let mut row = String::new();
    let mut cell = String::new();
    let mut cell_idx = 0usize;
    let mut in_header = false;

    let flush_para = |body: &mut String, runs: &mut String, heading: &Option<u8>, in_quote: bool, list: &[(bool, u64)]| {
        let mut ppr = String::new();
        if let Some(h) = heading {
            ppr.push_str(&format!("<w:pStyle w:val=\"Heading{h}\"/>"));
        } else if in_quote {
            ppr.push_str("<w:pStyle w:val=\"Quote\"/>");
        }
        if let Some((_, _)) = list.last() {
            let level = list.len() as i32 - 1;
            let ind = 360 + level * 360;
            ppr.push_str(&format!("<w:ind w:left=\"{}\" w:hanging=\"360\"/>", ind + 360));
        }
        let ppr = if ppr.is_empty() { String::new() } else { format!("<w:pPr>{ppr}</w:pPr>") };
        if !runs.is_empty() || ppr.contains("Heading") {
            body.push_str(&format!("<w:p>{ppr}{runs}</w:p>"));
        }
        runs.clear();
    };

    for ev in parser {
        match ev {
            Event::Start(Tag::Heading { level, .. }) => {
                heading = Some(match level {
                    HeadingLevel::H1 => 1,
                    HeadingLevel::H2 => 2,
                    HeadingLevel::H3 => 3,
                    HeadingLevel::H4 => 4,
                    HeadingLevel::H5 => 5,
                    HeadingLevel::H6 => 6,
                });
            }
            Event::End(TagEnd::Heading(_)) => {
                flush_para(&mut b.body, &mut runs, &heading, in_quote, &list_stack);
                heading = None;
            }
            Event::Start(Tag::Paragraph) => {}
            Event::End(TagEnd::Paragraph) => {
                if in_table {
                    // dentro de célula: nada (o texto vai no fechamento da célula)
                } else {
                    flush_para(&mut b.body, &mut runs, &heading, in_quote, &list_stack);
                }
            }
            Event::Start(Tag::Emphasis) => fmt.i = true,
            Event::End(TagEnd::Emphasis) => fmt.i = false,
            Event::Start(Tag::Strong) => fmt.b = true,
            Event::End(TagEnd::Strong) => fmt.b = false,
            Event::Start(Tag::Strikethrough) => fmt.strike = true,
            Event::End(TagEnd::Strikethrough) => fmt.strike = false,
            Event::Start(Tag::Link { .. }) => {
                fmt.link = true;
                link_alt.clear();
            }
            Event::End(TagEnd::Link) => {
                fmt.link = false;
            }
            Event::Start(Tag::BlockQuote(_)) => in_quote = true,
            Event::End(TagEnd::BlockQuote(_)) => in_quote = false,
            Event::Start(Tag::List(start)) => {
                list_stack.push((start.is_some(), start.unwrap_or(1)));
            }
            Event::End(TagEnd::List(_)) => {
                list_stack.pop();
            }
            Event::Start(Tag::Item) => {
                let prefix = if let Some((ordered, idx)) = list_stack.last_mut() {
                    if *ordered {
                        let s = format!("{}.  ", *idx);
                        *idx += 1;
                        s
                    } else {
                        "•  ".to_string()
                    }
                } else {
                    "•  ".to_string()
                };
                runs.push_str(&run(&prefix, &Fmt::default()));
            }
            Event::End(TagEnd::Item) => {
                flush_para(&mut b.body, &mut runs, &heading, in_quote, &list_stack);
            }
            Event::Start(Tag::CodeBlock(_)) => {
                code_block = Some(String::new());
            }
            Event::End(TagEnd::CodeBlock) => {
                if let Some(code) = code_block.take() {
                    for line in code.lines() {
                        b.body.push_str(&format!(
                            "<w:p><w:pPr><w:pStyle w:val=\"Code\"/></w:pPr>{}</w:p>",
                            run(line, &Fmt { code: true, ..Default::default() })
                        ));
                    }
                }
            }
            Event::Start(Tag::Image { dest_url, title, .. }) => {
                // acumula alt nos próximos Text; guarda url
                link_alt = format!("{dest_url}\u{1f}{title}");
                fmt.link = false;
            }
            Event::End(TagEnd::Image) => {
                let parts: Vec<&str> = link_alt.split('\u{1f}').collect();
                let url = parts.first().copied().unwrap_or("");
                let img = b.add_image(url, "");
                b.body.push_str(&img);
                link_alt.clear();
            }
            // tabela
            Event::Start(Tag::Table(a)) => {
                in_table = true;
                aligns = a;
                tbl.clear();
            }
            Event::End(TagEnd::Table) => {
                in_table = false;
                let borders = "<w:tblBorders><w:top w:val=\"single\" w:sz=\"4\" w:color=\"CBD5E1\"/><w:left w:val=\"single\" w:sz=\"4\" w:color=\"CBD5E1\"/><w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"CBD5E1\"/><w:right w:val=\"single\" w:sz=\"4\" w:color=\"CBD5E1\"/><w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"CBD5E1\"/><w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"CBD5E1\"/></w:tblBorders>";
                b.body.push_str(&format!(
                    "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/>{borders}</w:tblPr>{tbl}</w:tbl><w:p/>"
                ));
            }
            Event::Start(Tag::TableHead) => {
                in_header = true;
                row.clear();
            }
            Event::End(TagEnd::TableHead) => {
                tbl.push_str(&format!("<w:tr>{row}</w:tr>"));
                in_header = false;
            }
            Event::Start(Tag::TableRow) => {
                row.clear();
            }
            Event::End(TagEnd::TableRow) => {
                tbl.push_str(&format!("<w:tr>{row}</w:tr>"));
            }
            Event::Start(Tag::TableCell) => {
                cell.clear();
            }
            Event::End(TagEnd::TableCell) => {
                let al = aligns.get(cell_idx).copied().unwrap_or(Alignment::None);
                let jc = match al {
                    Alignment::Center => "<w:jc w:val=\"center\"/>",
                    Alignment::Right => "<w:jc w:val=\"right\"/>",
                    _ => "",
                };
                let inner = std::mem::take(&mut cell);
                row.push_str(&format!(
                    "<w:tc><w:p><w:pPr>{jc}</w:pPr>{inner}</w:p></w:tc>"
                ));
                cell_idx += 1;
            }
            Event::Text(t) => {
                if let Some(cb) = code_block.as_mut() {
                    cb.push_str(&t);
                } else if in_table {
                    cell.push_str(&run(&t, &Fmt { b: fmt.b || in_header, i: fmt.i, strike: fmt.strike, code: fmt.code, link: fmt.link }));
                } else if !link_alt.is_empty() && link_alt.contains('\u{1f}') {
                    // dentro de imagem: ignora (alt fica vazio)
                } else {
                    runs.push_str(&run(&t, &fmt));
                }
            }
            Event::Code(t) => {
                let f = Fmt { code: true, ..fmt.clone() };
                if in_table {
                    cell.push_str(&run(&t, &f));
                } else {
                    runs.push_str(&run(&t, &f));
                }
            }
            Event::SoftBreak | Event::HardBreak => {
                if let Some(cb) = code_block.as_mut() {
                    cb.push('\n');
                } else if in_table {
                    cell.push_str("<w:r><w:br/></w:r>");
                } else if matches!(ev, Event::HardBreak) {
                    runs.push_str("<w:r><w:br/></w:r>");
                } else {
                    runs.push_str(&run(" ", &fmt));
                }
            }
            Event::Rule => {
                b.body.push_str("<w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"1\" w:color=\"E2E8F0\"/></w:pBdr></w:pPr></w:p>");
            }
            _ => {}
        }
    }
    // sobra
    flush_para(&mut b.body, &mut runs, &heading, in_quote, &list_stack);

    assemble(&b, dest)
}

const STYLES: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="220" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="1E293B"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:i/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="480"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="CBD5E1"/></w:pBdr></w:pPr><w:rPr><w:i/><w:color w:val="475569"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:fill="F1F5F9"/><w:spacing w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>
</w:styles>"#;

fn assemble(b: &Builder, dest: &Path) -> Result<(), String> {
    let file = std::fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let opt: SimpleFileOptions = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut img_defaults = String::new();
    for ext in &b.exts {
        let ct = match ext.as_str() {
            "png" => "image/png",
            "jpg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            _ => "application/octet-stream",
        };
        img_defaults.push_str(&format!("<Default Extension=\"{ext}\" ContentType=\"{ct}\"/>"));
    }

    let content_types = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/>{img_defaults}<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/><Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/></Types>"
    );

    let root_rels = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>";

    let doc_rels = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rIdStyles\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>{}</Relationships>",
        b.rels
    );

    let document = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><w:body>{}<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\"/></w:sectPr></w:body></w:document>",
        b.body
    );

    let mut put = |name: &str, data: &[u8]| -> Result<(), String> {
        zip.start_file(name, opt).map_err(|e| e.to_string())?;
        zip.write_all(data).map_err(|e| e.to_string())
    };
    put("[Content_Types].xml", content_types.as_bytes())?;
    put("_rels/.rels", root_rels.as_bytes())?;
    put("word/document.xml", document.as_bytes())?;
    put("word/styles.xml", STYLES.as_bytes())?;
    put("word/_rels/document.xml.rels", doc_rels.as_bytes())?;
    for (name, bytes) in &b.media {
        put(&format!("word/media/{name}"), bytes)?;
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn generates_valid_docx() {
        let md = "# Título 1\n\n## Subtítulo\n\nTexto com **negrito**, *itálico*, ~~riscado~~ e `código`.\n\n- item um\n- item dois\n\n1. primeiro\n2. segundo\n\n> uma citação\n\n```rust\nlet x = 1;\nlet y = 2;\n```\n\n| Nome | Valor |\n|------|------|\n| A | 1 |\n| B | 2 |\n\n---\n\nFim.\n";
        let dest = std::env::temp_dir().join("quartzo-docx-test.docx");
        write_docx(md, vec![], &dest).expect("gerou docx");
        let bytes = std::fs::read(&dest).unwrap();
        assert!(bytes.starts_with(b"PK"), "deve ser um zip");

        let f = std::fs::File::open(&dest).unwrap();
        let mut zip = zip::ZipArchive::new(f).expect("zip válido");
        // partes obrigatórias presentes
        for part in ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels"] {
            assert!(zip.by_name(part).is_ok(), "falta {part}");
        }
        let mut doc = String::new();
        zip.by_name("word/document.xml").unwrap().read_to_string(&mut doc).unwrap();
        assert!(doc.contains("Heading1"), "tem título");
        assert!(doc.contains("<w:tbl>"), "tem tabela");
        assert!(doc.contains("<w:b/>"), "tem negrito");
        assert!(doc.contains("Consolas"), "tem código mono");
        assert!(doc.starts_with("<?xml"), "document.xml começa com prolog XML");
        // XML minimamente balanceado: nº de < e > iguais e sem '&' solto
        let lt = doc.matches('<').count();
        let gt = doc.matches('>').count();
        assert_eq!(lt, gt, "tags balanceadas");
    }
}

/// Decodifica %XX num caminho de imagem (sem dependências).
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
            if let Ok(v) = u8::from_str_radix(hex, 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}
