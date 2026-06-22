use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::Emitter;

/// Nó da árvore de arquivos do vault.
#[derive(Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

/// Lê um diretório recursivamente e devolve a árvore.
/// Pastas primeiro, depois arquivos, ambos em ordem alfabética.
#[tauri::command]
pub fn read_directory(path: String) -> Result<Vec<FileNode>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.is_dir() {
        return Err(format!("Caminho inválido ou não é uma pasta: {path}"));
    }
    read_dir_inner(dir_path)
}

fn read_dir_inner(dir_path: &Path) -> Result<Vec<FileNode>, String> {
    let mut nodes: Vec<FileNode> = Vec::new();

    let entries = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let file_path = entry.path();
        let file_name = match file_path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // Ignora ocultos e pastas de sistema.
        if file_name.starts_with('.') || file_name == "node_modules" {
            continue;
        }

        let is_dir = file_path.is_dir();
        let children = if is_dir {
            read_dir_inner(&file_path).ok()
        } else {
            None
        };

        nodes.push(FileNode {
            name: file_name,
            path: file_path.to_string_lossy().to_string(),
            is_dir,
            children,
        });
    }

    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(nodes)
}

/// Lê o conteúdo de um arquivo de texto.
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Salva (sobrescreve) um arquivo de texto. Cria as pastas-pai se necessário.
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// Cria uma nova nota .md numa pasta, evitando colisão de nome.
/// Retorna o caminho final criado.
#[tauri::command]
pub fn create_note(dir: String, base_name: String) -> Result<String, String> {
    let dir_path = Path::new(&dir);
    if !dir_path.is_dir() {
        return Err(format!("Pasta inválida: {dir}"));
    }

    let safe_base = if base_name.trim().is_empty() {
        "Sem título".to_string()
    } else {
        base_name.trim().to_string()
    };

    let mut candidate: PathBuf = dir_path.join(format!("{safe_base}.md"));
    let mut counter = 1;
    while candidate.exists() {
        candidate = dir_path.join(format!("{safe_base} {counter}.md"));
        counter += 1;
    }

    fs::write(&candidate, format!("# {safe_base}\n\n")).map_err(|e| e.to_string())?;
    Ok(candidate.to_string_lossy().to_string())
}

/// Cria uma nota (com pasta opcional + conteúdo pronto) evitando colisão. Retorna o caminho.
/// Usado pelos "tipos de nota" (front-matter pré-preenchido).
#[tauri::command]
pub fn create_note_full(
    vault: String,
    folder: String,
    base_name: String,
    content: String,
) -> Result<String, String> {
    let dir = if folder.trim().is_empty() {
        PathBuf::from(&vault)
    } else {
        Path::new(&vault).join(folder.trim())
    };
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe = {
        let s = sanitize_filename(&base_name);
        if s.is_empty() { "Sem título".to_string() } else { s }
    };
    let mut candidate = dir.join(format!("{safe}.md"));
    let mut n = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{safe} {n}.md"));
        n += 1;
    }
    fs::write(&candidate, content).map_err(|e| e.to_string())?;
    Ok(candidate.to_string_lossy().to_string())
}

/// Abre (ou cria) a nota do dia em `Diário/AAAA-MM-DD.md`. Retorna o caminho.
#[tauri::command]
pub fn daily_note(vault_path: String, date: String) -> Result<String, String> {
    let root = Path::new(&vault_path);
    if !root.is_dir() {
        return Err(format!("Vault inválido: {vault_path}"));
    }
    let dir = root.join("Diário");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe = sanitize_filename(&date);
    let path = dir.join(format!("{safe}.md"));
    if !path.exists() {
        fs::write(&path, format!("# {safe}\n\n")).map_err(|e| e.to_string())?;
    }
    Ok(path.to_string_lossy().to_string())
}

/// Cria uma nova pasta (evita colisão). Retorna o caminho criado.
#[tauri::command]
pub fn create_folder(parent: String, name: String) -> Result<String, String> {
    let dir = Path::new(&parent);
    if !dir.is_dir() {
        return Err(format!("Pasta inválida: {parent}"));
    }
    let safe = sanitize_filename(&name);
    let base = if safe.is_empty() { "Nova pasta".to_string() } else { safe };
    let mut candidate: PathBuf = dir.join(&base);
    let mut counter = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{base} {counter}"));
        counter += 1;
    }
    fs::create_dir(&candidate).map_err(|e| e.to_string())?;
    Ok(candidate.to_string_lossy().to_string())
}

// ==================== GRAPH INDEX ====================

#[derive(Serialize, Clone)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub group: String,
    pub path: String,
    pub word_count: usize,
    pub tags: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub kind: String,
}

#[derive(Serialize, Clone)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

fn collect_md(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let p = entry.path();
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name.starts_with('.') || name == "node_modules" {
            continue;
        }
        if p.is_dir() {
            collect_md(&p, out);
        } else if p.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("md")) == Some(true) {
            out.push(p);
        }
    }
}

fn stem(path: &Path) -> String {
    path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string()
}

/// Extrai (alvo, é_embed) de cada [[wikilink]] / ![[embed]] do conteúdo.
fn parse_links(content: &str) -> Vec<(String, bool)> {
    let bytes = content.as_bytes();
    let mut links = Vec::new();
    let mut idx = 0;
    while let Some(rel) = content[idx..].find("[[") {
        let start = idx + rel;
        let is_embed = start > 0 && bytes[start - 1] == b'!';
        if let Some(end_rel) = content[start + 2..].find("]]") {
            let end = start + 2 + end_rel;
            let inner = &content[start + 2..end];
            let target = inner.split('|').next().unwrap_or("").split('#').next().unwrap_or("").trim();
            if !target.is_empty() {
                links.push((target.to_lowercase(), is_embed));
            }
            idx = end + 2;
        } else {
            break;
        }
    }
    links
}

/// Extrai #tags (ignora cabeçalhos markdown "# ").
fn parse_tags(content: &str) -> Vec<String> {
    let chars: Vec<char> = content.chars().collect();
    let mut tags = Vec::new();
    let mut seen = HashSet::new();
    for k in 0..chars.len() {
        if chars[k] != '#' {
            continue;
        }
        let prev_ws = k == 0 || chars[k - 1].is_whitespace();
        if !prev_ws {
            continue;
        }
        let mut tag = String::new();
        let mut j = k + 1;
        while j < chars.len() {
            let c = chars[j];
            if c.is_alphanumeric() || c == '_' || c == '-' || c == '/' {
                tag.push(c);
                j += 1;
            } else {
                break;
            }
        }
        if let Some(first) = tag.chars().next() {
            if first.is_alphabetic() && seen.insert(tag.clone()) {
                tags.push(tag);
            }
        }
    }
    tags
}

/// Varre o vault e monta o índice de grafo (nós = notas, arestas = wikilinks/embeds).
#[tauri::command]
pub fn build_graph_index(vault_path: String) -> Result<GraphData, String> {
    let root = Path::new(&vault_path);
    if !root.is_dir() {
        return Err(format!("Vault inválido: {vault_path}"));
    }

    let mut files = Vec::new();
    collect_md(root, &mut files);

    // mapa nome(minúsculo, sem extensão) -> caminho, para resolver wikilinks
    let mut by_stem: HashMap<String, String> = HashMap::new();
    for f in &files {
        let key = stem(f).to_lowercase();
        by_stem.entry(key).or_insert_with(|| f.to_string_lossy().to_string());
    }

    let mut nodes = Vec::with_capacity(files.len());
    let mut edges = Vec::new();
    let mut edge_seen: HashSet<String> = HashSet::new();

    for f in &files {
        let path_str = f.to_string_lossy().to_string();
        let content = fs::read_to_string(f).unwrap_or_default();

        let group = f
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("vault")
            .to_string();

        nodes.push(GraphNode {
            id: path_str.clone(),
            label: stem(f),
            group,
            path: path_str.clone(),
            word_count: content.split_whitespace().count(),
            tags: parse_tags(&content),
        });

        for (target, is_embed) in parse_links(&content) {
            if let Some(target_path) = by_stem.get(&target) {
                if *target_path == path_str {
                    continue; // ignora auto-link
                }
                let kind = if is_embed { "embed" } else { "wikilink" };
                let key = format!("{path_str}=>{target_path}=>{kind}");
                if edge_seen.insert(key.clone()) {
                    edges.push(GraphEdge {
                        id: key,
                        source: path_str.clone(),
                        target: target_path.clone(),
                        kind: kind.to_string(),
                    });
                }
            }
        }
    }

    Ok(GraphData { nodes, edges })
}

// ==================== MEMÓRIAS DO CLAUDE ====================

fn sanitize_filename(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

/// Cria uma "Memória do Claude" em `00 - Memórias do Claude/` com frontmatter.
/// Nome do arquivo: `YYYY-MM-DD - Título.md` (evita colisão). Retorna o caminho.
#[tauri::command]
pub fn save_memory(
    vault: String,
    title: String,
    content: String,
    tags: Vec<String>,
    date: String,
) -> Result<String, String> {
    let root = Path::new(&vault);
    if !root.is_dir() {
        return Err(format!("Vault inválido: {vault}"));
    }
    let dir = root.join("00 - Memórias do Claude");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let safe_title = {
        let t = sanitize_filename(&title);
        if t.is_empty() { "Sem título".to_string() } else { t }
    };

    let base = format!("{date} - {safe_title}");
    let mut candidate = dir.join(format!("{base}.md"));
    let mut n = 1;
    while candidate.exists() {
        candidate = dir.join(format!("{base} {n}.md"));
        n += 1;
    }

    let tags_line = tags
        .iter()
        .map(|t| t.trim())
        .filter(|t| !t.is_empty())
        .collect::<Vec<_>>()
        .join(", ");

    let body = format!(
        "---\ntype: claude-memory\ndate: {date}\nsource: \"VS Code - Claude\"\ntags: [{tags_line}]\n---\n\n# {safe_title}\n\n{content}\n",
        content = content.trim()
    );

    fs::write(&candidate, body).map_err(|e| e.to_string())?;
    Ok(candidate.to_string_lossy().to_string())
}

// ==================== BACKLINKS ====================

#[derive(Serialize, Clone)]
pub struct Backlink {
    pub path: String,
    pub name: String,
    pub snippet: String,
}

/// Notas que linkam (via `[[ ]]`) para o arquivo alvo, resolvido por nome.
#[tauri::command]
pub fn get_backlinks(vault_path: String, target_path: String) -> Result<Vec<Backlink>, String> {
    let root = Path::new(&vault_path);
    if !root.is_dir() {
        return Ok(vec![]);
    }
    let target_stem = stem(Path::new(&target_path)).to_lowercase();
    if target_stem.is_empty() {
        return Ok(vec![]);
    }

    let mut files = Vec::new();
    collect_md(root, &mut files);

    let mut out = Vec::new();
    for f in &files {
        let path_str = f.to_string_lossy().to_string();
        if path_str == target_path {
            continue;
        }
        let content = fs::read_to_string(f).unwrap_or_default();
        let links = parse_links(&content);
        if links.iter().any(|(t, _)| *t == target_stem) {
            let snippet = content
                .lines()
                .find(|l| parse_links(l).iter().any(|(t, _)| *t == target_stem))
                .map(|l| l.trim().chars().take(160).collect::<String>())
                .unwrap_or_default();
            out.push(Backlink { path: path_str, name: stem(f), snippet });
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

fn is_word_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// Acha `needle` em `haystack` como palavra inteira (limites não-alfanuméricos).
/// Ambos devem estar em minúsculas.
fn find_word(haystack: &str, needle: &str) -> Option<usize> {
    if needle.is_empty() {
        return None;
    }
    let hb = haystack.as_bytes();
    let nlen = needle.len();
    let mut start = 0;
    while let Some(rel) = haystack[start..].find(needle) {
        let i = start + rel;
        let before_ok = i == 0 || !is_word_byte(hb[i - 1]);
        let after = i + nlen;
        let after_ok = after >= hb.len() || !is_word_byte(hb[after]);
        if before_ok && after_ok {
            return Some(i);
        }
        start = i + 1;
        if start >= haystack.len() {
            break;
        }
    }
    None
}

/// Notas que MENCIONAM o nome do alvo como texto puro (palavra inteira) mas
/// NÃO o linkam via `[[ ]]` — as "unlinked mentions" do Obsidian.
#[tauri::command]
pub fn get_unlinked_mentions(
    vault_path: String,
    target_path: String,
) -> Result<Vec<Backlink>, String> {
    let root = Path::new(&vault_path);
    if !root.is_dir() {
        return Ok(vec![]);
    }
    let target_stem = stem(Path::new(&target_path));
    let needle = target_stem.to_lowercase();
    if needle.len() < 2 {
        return Ok(vec![]);
    }

    let mut files = Vec::new();
    collect_md(root, &mut files);

    let mut out = Vec::new();
    for f in &files {
        let path_str = f.to_string_lossy().to_string();
        if path_str == target_path {
            continue;
        }
        let content = fs::read_to_string(f).unwrap_or_default();
        let lower = content.to_lowercase();
        if find_word(&lower, &needle).is_none() {
            continue;
        }
        // Se já linka via [[ ]], não conta como menção não-linkada.
        if parse_links(&content).iter().any(|(t, _)| *t == needle) {
            continue;
        }
        // Primeira linha que menciona a palavra fora de um wikilink.
        let snippet = content
            .lines()
            .find(|l| {
                let ll = l.to_lowercase();
                find_word(&ll, &needle).is_some() && !ll.contains(&format!("[[{needle}"))
            })
            .map(|l| l.trim().chars().take(160).collect::<String>())
            .unwrap_or_default();
        if !snippet.is_empty() {
            out.push(Backlink { path: path_str, name: stem(f), snippet });
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

// ==================== ÍNDICE DE CONSULTA (views por front-matter) ====================

#[derive(Serialize, Clone)]
pub struct QueryTask {
    pub text: String,
    pub checked: bool,
    pub line: u32,
}

#[derive(Serialize, Clone)]
pub struct QueryNote {
    pub path: String,
    pub name: String,
    pub folder: String,
    pub props: HashMap<String, Vec<String>>,
    pub tags: Vec<String>,
    pub tasks: Vec<QueryTask>,
}

fn unquote(s: &str) -> String {
    let t = s.trim();
    if t.len() >= 2 {
        let b = t.as_bytes();
        if (b[0] == b'"' && b[t.len() - 1] == b'"') || (b[0] == b'\'' && b[t.len() - 1] == b'\'') {
            return t[1..t.len() - 1].to_string();
        }
    }
    t.to_string()
}

/// Lê o front-matter YAML simples (chave: valor / listas) em um mapa.
fn parse_frontmatter_props(content: &str) -> HashMap<String, Vec<String>> {
    let mut props: HashMap<String, Vec<String>> = HashMap::new();
    if !content.starts_with("---") {
        return props;
    }
    let mut lines = content.lines();
    lines.next(); // primeira linha "---"
    let mut cur_key: Option<String> = None;
    for line in lines {
        if line.trim() == "---" {
            break;
        }
        if line.trim().is_empty() {
            continue;
        }
        if let Some(item) = line.trim().strip_prefix("- ") {
            if let Some(k) = &cur_key {
                props.entry(k.clone()).or_default().push(unquote(item));
            }
            continue;
        }
        if let Some(idx) = line.find(':') {
            let key = line[..idx].trim().to_string();
            if key.is_empty() || key.starts_with('#') {
                continue;
            }
            let val = line[idx + 1..].trim();
            let mut vals = Vec::new();
            if val.starts_with('[') && val.ends_with(']') && val.len() >= 2 {
                for v in val[1..val.len() - 1].split(',') {
                    let u = unquote(v);
                    if !u.is_empty() {
                        vals.push(u);
                    }
                }
            } else if !val.is_empty() {
                vals.push(unquote(val));
            }
            props.insert(key.clone(), vals);
            cur_key = Some(key);
        }
    }
    props
}

/// Extrai tarefas `- [ ]` / `- [x]` com número de linha.
fn parse_task_list(content: &str) -> Vec<QueryTask> {
    let mut out = Vec::new();
    for (i, line) in content.lines().enumerate() {
        let t = line.trim_start();
        let rest = match t.strip_prefix("- [").or_else(|| t.strip_prefix("* [")) {
            Some(r) => r,
            None => continue,
        };
        let b = rest.as_bytes();
        if b.len() >= 2 && b[1] == b']' {
            let mark = b[0] as char;
            let checked = mark == 'x' || mark == 'X';
            let text = rest[2..].trim().to_string();
            out.push(QueryTask { text, checked, line: i as u32 });
        }
    }
    out
}

/// Varre o vault e devolve, por nota, front-matter + tags + tarefas (p/ as views dinâmicas).
#[tauri::command]
pub fn build_query_index(vault_path: String) -> Result<Vec<QueryNote>, String> {
    let root = Path::new(&vault_path);
    if !root.is_dir() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    collect_md(root, &mut files);

    let mut out = Vec::with_capacity(files.len());
    for f in &files {
        let content = fs::read_to_string(f).unwrap_or_default();
        let folder = f
            .parent()
            .and_then(|p| p.strip_prefix(root).ok())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        out.push(QueryNote {
            path: f.to_string_lossy().to_string(),
            name: stem(f),
            folder,
            props: parse_frontmatter_props(&content),
            tags: parse_tags(&content),
            tasks: parse_task_list(&content),
        });
    }
    Ok(out)
}

/// Alterna uma tarefa `- [ ]` <-> `- [x]` numa linha específica. Retorna o novo estado.
#[tauri::command]
pub fn toggle_task(path: String, line: u32) -> Result<bool, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let nl = if content.contains("\r\n") { "\r\n" } else { "\n" };
    let mut lines: Vec<String> = content.split(nl).map(|s| s.to_string()).collect();
    let idx = line as usize;
    if idx >= lines.len() {
        return Err("Linha fora do intervalo".into());
    }
    let l = &lines[idx];
    let checked;
    if let Some(pos) = l.find("- [ ]") {
        lines[idx] = format!("{}- [x]{}", &l[..pos], &l[pos + 5..]);
        checked = true;
    } else if let Some(pos) = l.to_lowercase().find("- [x]") {
        lines[idx] = format!("{}- [ ]{}", &l[..pos], &l[pos + 5..]);
        checked = false;
    } else {
        return Err("Não é uma tarefa".into());
    }
    fs::write(&path, lines.join(nl)).map_err(|e| e.to_string())?;
    Ok(checked)
}

// ==================== IMAGEM -> DATA URL (p/ extrair paleta) ====================

fn b64_encode(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = *chunk.get(1).unwrap_or(&0);
        let b2 = *chunk.get(2).unwrap_or(&0);
        out.push(T[(b0 >> 2) as usize] as char);
        out.push(T[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        out.push(if chunk.len() > 1 { T[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { T[(b2 & 0x3f) as usize] as char } else { '=' });
    }
    out
}

/// Lê uma imagem e devolve um data URL (base64). Data URL = mesma origem -> canvas
/// não fica "tainted", então dá pra ler pixels e extrair a paleta.
#[tauri::command]
pub fn read_image_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let mime = match Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        Some("avif") => "image/avif",
        _ => "application/octet-stream",
    };
    Ok(format!("data:{};base64,{}", mime, b64_encode(&bytes)))
}

fn b64_decode(s: &str) -> Vec<u8> {
    fn val(c: u8) -> i16 {
        match c {
            b'A'..=b'Z' => (c - b'A') as i16,
            b'a'..=b'z' => (c - b'a' + 26) as i16,
            b'0'..=b'9' => (c - b'0' + 52) as i16,
            b'+' => 62,
            b'/' => 63,
            _ => -1,
        }
    }
    let mut out = Vec::with_capacity(s.len() / 4 * 3);
    let mut buf: u32 = 0;
    let mut bits = 0;
    for &c in s.as_bytes() {
        let v = val(c);
        if v < 0 {
            continue;
        }
        buf = (buf << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    out
}

/// Salva uma imagem (base64) colada/arrastada no Canvas em `.quartzo/canvas-assets/`.
/// Nome = hash do conteúdo (dedup). Retorna o caminho do arquivo.
#[tauri::command]
pub fn save_canvas_image(vault: String, b64: String, ext: String) -> Result<String, String> {
    let bytes = b64_decode(&b64);
    if bytes.is_empty() {
        return Err("Imagem vazia".into());
    }
    let dir = Path::new(&vault).join(".quartzo").join("canvas-assets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut h: u64 = 1469598103934665603;
    for b in &bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(1099511628211);
    }
    let safe_ext = if ext.is_empty() { "png".to_string() } else { ext.to_lowercase() };
    let path = dir.join(format!("img-{h:x}.{safe_ext}"));
    if !path.exists() {
        fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    }
    Ok(path.to_string_lossy().to_string())
}

// ==================== CSS SNIPPETS ====================

#[derive(Serialize, Clone)]
pub struct CssSnippet {
    pub name: String,
    pub content: String,
}

/// Lista os snippets CSS do vault em `.quartzo/snippets/*.css`.
/// Cria a pasta (com um exemplo) na primeira vez, pra o usuário saber onde pôr.
#[tauri::command]
pub fn list_css_snippets(vault_path: String) -> Result<Vec<CssSnippet>, String> {
    let dir = Path::new(&vault_path).join(".quartzo").join("snippets");
    if !dir.is_dir() {
        let _ = fs::create_dir_all(&dir);
        let example = dir.join("exemplo.css");
        if !example.exists() {
            let _ = fs::write(
                &example,
                "/* Snippet de exemplo do Quartzo.\n   Ative em Configurações > Aparência > CSS Snippets.\n   Edite este arquivo e recarregue. */\n\n/* Exemplo: deixar os títulos do preview mais cristalinos\n.q-prose h1 { color: #a5f3fc; }\n*/\n",
            );
        }
    }
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for e in entries.flatten() {
            let p = e.path();
            let is_css = p
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x.eq_ignore_ascii_case("css"))
                == Some(true);
            if !is_css {
                continue;
            }
            let name = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
            if name.is_empty() {
                continue;
            }
            let content = fs::read_to_string(&p).unwrap_or_default();
            out.push(CssSnippet { name, content });
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

// ==================== NUVEM (pasta sincronizada: Google Drive / OneDrive) ====================

#[derive(Serialize, Clone)]
pub struct CloudFolder {
    pub name: String,
    pub path: String,
}

fn push_cloud(out: &mut Vec<CloudFolder>, seen: &mut HashSet<String>, name: &str, p: PathBuf) {
    if p.is_dir() {
        let s = p.to_string_lossy().to_string();
        if seen.insert(s.clone()) {
            out.push(CloudFolder { name: name.into(), path: s });
        }
    }
}

/// Detecta pastas de nuvem instaladas (Google Drive para Desktop / OneDrive).
#[tauri::command]
pub fn detect_cloud_folders() -> Vec<CloudFolder> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();

    for var in ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"] {
        if let Ok(v) = std::env::var(var) {
            push_cloud(&mut out, &mut seen, "OneDrive", PathBuf::from(v));
        }
    }
    if let Ok(up) = std::env::var("USERPROFILE") {
        push_cloud(&mut out, &mut seen, "Google Drive", PathBuf::from(&up).join("Google Drive"));
        push_cloud(&mut out, &mut seen, "OneDrive", PathBuf::from(&up).join("OneDrive"));
    }
    // Google Drive para Desktop monta como letra de disco com "My Drive"/"Meu Drive".
    for letter in b'C'..=b'Z' {
        let l = letter as char;
        for n in ["My Drive", "Meu Drive"] {
            push_cloud(&mut out, &mut seen, "Google Drive", PathBuf::from(format!("{l}:\\{n}")));
        }
    }
    out
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dest)?;
        } else {
            fs::copy(entry.path(), &dest)?;
        }
    }
    Ok(())
}

/// Copia o vault para `<cloud_parent>/Quartzo/<nome-do-vault>` (a nuvem sincroniza sozinha).
/// Retorna o novo caminho. O original é preservado como backup.
#[tauri::command]
pub fn copy_vault_to_cloud(vault: String, cloud_parent: String) -> Result<String, String> {
    let src = Path::new(&vault);
    if !src.is_dir() {
        return Err("Vault inválido".into());
    }
    let name = src
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Nome do vault inválido")?;
    let dest = Path::new(&cloud_parent).join("Quartzo").join(name);
    if dest.exists() {
        return Err(format!("Já existe uma pasta \"{name}\" no destino da nuvem"));
    }
    copy_dir_all(src, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

// ==================== INTEGRAÇÃO COM O PRISMA ====================

/// Lança o app PRISMA (DAM do Paulo) se estiver instalado. Caminhos comuns do NSIS.
#[tauri::command]
pub fn launch_prisma() -> Result<(), String> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(la) = std::env::var("LOCALAPPDATA") {
        candidates.push(Path::new(&la).join("PRISMA").join("prisma.exe"));
        candidates.push(Path::new(&la).join("Programs").join("PRISMA").join("prisma.exe"));
    }
    if let Ok(pf) = std::env::var("ProgramFiles") {
        candidates.push(Path::new(&pf).join("PRISMA").join("prisma.exe"));
    }
    for c in &candidates {
        if c.exists() {
            let mut cmd = Command::new(c);
            no_window(&mut cmd);
            cmd.spawn().map_err(|e| e.to_string())?;
            return Ok(());
        }
    }
    Err("PRISMA não encontrado. Instale o PRISMA (ou abra-o manualmente).".into())
}

/// Verifica se o PRISMA está instalado.
#[tauri::command]
pub fn prisma_installed() -> bool {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(la) = std::env::var("LOCALAPPDATA") {
        candidates.push(Path::new(&la).join("PRISMA").join("prisma.exe"));
        candidates.push(Path::new(&la).join("Programs").join("PRISMA").join("prisma.exe"));
    }
    if let Ok(pf) = std::env::var("ProgramFiles") {
        candidates.push(Path::new(&pf).join("PRISMA").join("prisma.exe"));
    }
    candidates.iter().any(|c| c.exists())
}

// ==================== GIT (versionamento local) ====================

#[cfg(windows)]
fn no_window(c: &mut Command) {
    use std::os::windows::process::CommandExt;
    c.creation_flags(0x08000000); // CREATE_NO_WINDOW (sem flash de console)
}
#[cfg(not(windows))]
fn no_window(_c: &mut Command) {}

fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(cwd).args(args);
    no_window(&mut cmd);
    let out = cmd
        .output()
        .map_err(|e| format!("Git não encontrado no sistema: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[derive(Serialize, Clone)]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub changed: Vec<String>,
    pub clean: bool,
}

/// Estado do repositório do vault (é repo? branch? arquivos alterados?).
#[tauri::command]
pub fn git_status(vault: String) -> Result<GitStatus, String> {
    if run_git(&vault, &["rev-parse", "--is-inside-work-tree"]).is_err() {
        return Ok(GitStatus { is_repo: false, branch: String::new(), changed: vec![], clean: true });
    }
    let branch = run_git(&vault, &["rev-parse", "--abbrev-ref", "HEAD"])
        .unwrap_or_default()
        .trim()
        .to_string();
    let porcelain = run_git(&vault, &["status", "--porcelain"]).unwrap_or_default();
    let changed: Vec<String> = porcelain
        .lines()
        .map(|l| l.trim_end().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    let clean = changed.is_empty();
    Ok(GitStatus {
        is_repo: true,
        branch: if branch.is_empty() || branch == "HEAD" { "main".into() } else { branch },
        changed,
        clean,
    })
}

/// Inicia o versionamento (git init) no vault + um .gitignore básico.
#[tauri::command]
pub fn git_init(vault: String) -> Result<(), String> {
    run_git(&vault, &["init"])?;
    let _ = run_git(&vault, &["symbolic-ref", "HEAD", "refs/heads/main"]);
    let gi = Path::new(&vault).join(".gitignore");
    if !gi.exists() {
        let _ = fs::write(&gi, ".quartzo/canvas-assets/\n.DS_Store\nThumbs.db\n");
    }
    Ok(())
}

/// Salva uma versão (git add -A + commit). Retorna a saída do commit.
#[tauri::command]
pub fn git_commit(vault: String, message: String) -> Result<String, String> {
    run_git(&vault, &["add", "-A"])?;
    let msg = if message.trim().is_empty() {
        "Versão do Quartzo".to_string()
    } else {
        message
    };
    run_git(&vault, &["commit", "-m", &msg])
}

#[derive(Serialize, Clone)]
pub struct GitCommit {
    pub hash: String,
    pub subject: String,
    pub author: String,
    pub when: String,
}

/// Histórico de commits (mais recentes primeiro).
#[tauri::command]
pub fn git_log(vault: String, limit: u32) -> Result<Vec<GitCommit>, String> {
    let n = limit.max(1).to_string();
    let out = run_git(
        &vault,
        &["log", "-n", &n, "--pretty=format:%h%x1f%s%x1f%an%x1f%ar"],
    )
    .unwrap_or_default();
    let mut v = Vec::new();
    for line in out.lines() {
        let p: Vec<&str> = line.split('\u{1f}').collect();
        if p.len() == 4 {
            v.push(GitCommit {
                hash: p[0].into(),
                subject: p[1].into(),
                author: p[2].into(),
                when: p[3].into(),
            });
        }
    }
    Ok(v)
}

// ==================== FILE WATCHER ====================

pub struct WatchState(pub Mutex<Option<RecommendedWatcher>>);

/// Observa o vault e emite `vault-changed` no frontend a cada mudança.
#[tauri::command]
pub fn start_vault_watch(
    app: tauri::AppHandle,
    state: tauri::State<WatchState>,
    path: String,
) -> Result<(), String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("Vault inválido: {path}"));
    }
    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if res.is_ok() {
            let _ = app_handle.emit("vault-changed", ());
        }
    })
    .map_err(|e| e.to_string())?;

    watcher
        .watch(dir, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    // Substitui o watcher anterior (dropando o antigo).
    *state.0.lock().map_err(|e| e.to_string())? = Some(watcher);
    Ok(())
}

// ==================== RENOMEAR / APAGAR ====================

/// Renomeia um arquivo/pasta dentro da mesma pasta. Preserva a extensão de
/// arquivos quando o novo nome não traz uma. Retorna o novo caminho.
#[tauri::command]
pub fn rename_path(path: String, new_name: String) -> Result<String, String> {
    let p = Path::new(&path);
    let parent = p.parent().ok_or("Sem pasta pai")?;
    let safe = sanitize_filename(&new_name);
    if safe.is_empty() {
        return Err("Nome inválido".into());
    }
    let mut final_name = safe.clone();
    if p.is_file() && Path::new(&safe).extension().is_none() {
        if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
            final_name = format!("{safe}.{ext}");
        }
    }
    let dest = parent.join(&final_name);
    if dest.exists() {
        return Err("Já existe um item com esse nome".into());
    }
    fs::rename(p, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

/// Move um arquivo/pasta para a Lixeira (recuperável).
#[tauri::command]
pub fn delete_to_trash(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}

// ==================== BUSCA GLOBAL (FULL-TEXT) ====================

#[derive(Serialize, Clone)]
pub struct SearchHit {
    pub path: String,
    pub name: String,
    pub line: u32,
    pub snippet: String,
}

#[derive(Serialize, Clone)]
pub struct TagCount {
    pub tag: String,
    pub count: u32,
}

/// Lista todas as #tags do vault com contagem (mais usadas primeiro).
#[tauri::command]
pub fn list_tags(vault_path: String) -> Result<Vec<TagCount>, String> {
    let root = Path::new(&vault_path);
    if !root.is_dir() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    collect_md(root, &mut files);
    let mut map: HashMap<String, u32> = HashMap::new();
    for f in &files {
        let content = fs::read_to_string(f).unwrap_or_default();
        for t in parse_tags(&content) {
            *map.entry(t).or_insert(0) += 1;
        }
    }
    let mut out: Vec<TagCount> = map.into_iter().map(|(tag, count)| TagCount { tag, count }).collect();
    out.sort_by(|a, b| b.count.cmp(&a.count).then(a.tag.to_lowercase().cmp(&b.tag.to_lowercase())));
    Ok(out)
}

/// Busca o termo dentro do conteúdo de todas as notas .md (case-insensitive).
#[tauri::command]
pub fn search_notes(vault_path: String, query: String) -> Result<Vec<SearchHit>, String> {
    let q = query.trim().to_lowercase();
    if q.len() < 2 {
        return Ok(vec![]);
    }
    let root = Path::new(&vault_path);
    if !root.is_dir() {
        return Ok(vec![]);
    }
    let mut files = Vec::new();
    collect_md(root, &mut files);

    let mut hits = Vec::new();
    'outer: for f in &files {
        let content = fs::read_to_string(f).unwrap_or_default();
        let path_str = f.to_string_lossy().to_string();
        let name = stem(f);
        for (i, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&q) {
                let snippet: String = line.trim().chars().take(180).collect();
                hits.push(SearchHit {
                    path: path_str.clone(),
                    name: name.clone(),
                    line: (i + 1) as u32,
                    snippet,
                });
                if hits.len() >= 300 {
                    break 'outer;
                }
            }
        }
    }
    Ok(hits)
}
