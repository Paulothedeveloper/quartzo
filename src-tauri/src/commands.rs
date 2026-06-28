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

// ---- Aliases de front-matter (resolvíveis em [[wikilink]]) ----

/// Devolve o miolo do bloco de front-matter (entre o 1º --- e o próximo ---).
fn frontmatter_block(content: &str) -> Option<&str> {
    let c = content.strip_prefix('\u{feff}').unwrap_or(content);
    if !(c.starts_with("---\n") || c.starts_with("---\r\n")) {
        return None;
    }
    let after = c.find('\n')? + 1;
    let rest = &c[after..];
    let end = rest.find("\n---")?;
    Some(&rest[..end])
}

/// Extrai os aliases declarados no front-matter (aliases:/alias:),
/// suportando lista em linha [a, b], escalar, e lista em bloco "- a".
fn parse_aliases(content: &str) -> Vec<String> {
    let fm = match frontmatter_block(content) {
        Some(s) => s,
        None => return vec![],
    };
    let lines: Vec<&str> = fm.lines().collect();
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        let trimmed = lines[i].trim_start();
        let key = trimmed
            .strip_prefix("aliases:")
            .or_else(|| trimmed.strip_prefix("alias:"));
        if let Some(rest) = key {
            let val = rest.trim();
            if val.is_empty() {
                // lista em bloco nas linhas seguintes
                let mut j = i + 1;
                while j < lines.len() {
                    let t = lines[j].trim_start();
                    if let Some(item) = t.strip_prefix("- ") {
                        out.push(unquote(item));
                        j += 1;
                    } else if lines[j].trim().is_empty() {
                        j += 1;
                    } else {
                        break;
                    }
                }
            } else if val.starts_with('[') {
                let inner = val.trim_start_matches('[').trim_end_matches(']');
                for part in inner.split(',') {
                    let p = unquote(part);
                    if !p.is_empty() {
                        out.push(p);
                    }
                }
            } else {
                out.push(unquote(val));
            }
            break;
        }
        i += 1;
    }
    out.into_iter().filter(|s| !s.is_empty()).collect()
}

/// Índice de aliases do vault: pares (alias_minúsculo, caminho_da_nota).
#[tauri::command]
pub fn build_alias_index(vault_path: String) -> Result<Vec<(String, String)>, String> {
    let root = Path::new(&vault_path);
    if !root.is_dir() {
        return Err(format!("Vault inválido: {vault_path}"));
    }
    let mut files = Vec::new();
    collect_md(root, &mut files);
    let mut out = Vec::new();
    for f in &files {
        let content = fs::read_to_string(f).unwrap_or_default();
        for a in parse_aliases(&content) {
            out.push((a.to_lowercase(), f.to_string_lossy().to_string()));
        }
    }
    Ok(out)
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
    // mapa caminho-relativo(minúsculo, com / e sem .md) -> caminho, p/ wikilinks por caminho
    let mut by_relpath: HashMap<String, String> = HashMap::new();
    for f in &files {
        let full = f.to_string_lossy().to_string();
        let key = stem(f).to_lowercase();
        by_stem.entry(key).or_insert_with(|| full.clone());
        if let Ok(rel) = f.strip_prefix(root) {
            let rel = rel.to_string_lossy().replace('\\', "/").to_lowercase();
            let no_ext = rel.strip_suffix(".md").unwrap_or(&rel).to_string();
            by_relpath.entry(rel).or_insert_with(|| full.clone());
            by_relpath.entry(no_ext).or_insert_with(|| full.clone());
        }
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
            // wikilink por caminho ("pasta/Nota") usa o mapa de caminho relativo;
            // senão cai no nome (stem).
            let resolved = if target.contains('/') {
                let norm = target.replace('\\', "/");
                let no_ext = norm.strip_suffix(".md").unwrap_or(&norm).to_string();
                by_relpath.get(&no_ext).or_else(|| by_relpath.get(&norm))
            } else {
                by_stem.get(&target)
            };
            if let Some(target_path) = resolved {
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

// ---- Visão do vault: notas órfãs + recentes ----

#[derive(Serialize, Clone)]
pub struct NoteInfo {
    pub path: String,
    pub name: String,
    pub rel: String,
    pub modified: u64,
}
#[derive(Serialize, Clone)]
pub struct VaultInsights {
    pub orphans: Vec<NoteInfo>,
    pub recents: Vec<NoteInfo>,
    pub total: usize,
}

/// Órfãs (nenhum link de entrada nem de saída) + recentes (por data de modificação).
/// A resolução de links espelha a do grafo (por nome ou por caminho relativo).
#[tauri::command]
pub fn vault_insights(vault: String, recent_limit: usize) -> Result<VaultInsights, String> {
    let root = Path::new(&vault);
    if !root.is_dir() {
        return Err(format!("Vault inválido: {vault}"));
    }
    let mut files = Vec::new();
    collect_md(root, &mut files);

    // mapas de resolução (iguais ao build_graph_index)
    let mut by_stem: HashMap<String, String> = HashMap::new();
    let mut by_relpath: HashMap<String, String> = HashMap::new();
    for f in &files {
        let full = f.to_string_lossy().to_string();
        by_stem.entry(stem(f).to_lowercase()).or_insert_with(|| full.clone());
        if let Ok(rel) = f.strip_prefix(root) {
            let rel = rel.to_string_lossy().replace('\\', "/").to_lowercase();
            let no_ext = rel.strip_suffix(".md").unwrap_or(&rel).to_string();
            by_relpath.entry(rel).or_insert_with(|| full.clone());
            by_relpath.entry(no_ext).or_insert_with(|| full.clone());
        }
    }

    // grau total (entrada + saída) por caminho
    let mut degree: HashMap<String, usize> = HashMap::new();
    for f in &files {
        degree.insert(f.to_string_lossy().to_string(), 0);
    }
    for f in &files {
        let path_str = f.to_string_lossy().to_string();
        let content = fs::read_to_string(f).unwrap_or_default();
        for (target, _embed) in parse_links(&content) {
            let resolved = if target.contains('/') {
                let norm = target.replace('\\', "/");
                let no_ext = norm.strip_suffix(".md").unwrap_or(&norm).to_string();
                by_relpath.get(&no_ext).or_else(|| by_relpath.get(&norm))
            } else {
                by_stem.get(&target)
            };
            if let Some(tp) = resolved {
                if *tp == path_str {
                    continue;
                }
                *degree.entry(path_str.clone()).or_insert(0) += 1;
                *degree.entry(tp.clone()).or_insert(0) += 1;
            }
        }
    }

    let info = |f: &PathBuf| -> NoteInfo {
        let modified = fs::metadata(f)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let rel = f.strip_prefix(root).unwrap_or(f).to_string_lossy().replace('\\', "/");
        NoteInfo {
            path: f.to_string_lossy().to_string(),
            name: f.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
            rel,
            modified,
        }
    };

    let mut orphans: Vec<NoteInfo> = files
        .iter()
        .filter(|f| degree.get(&f.to_string_lossy().to_string()).copied().unwrap_or(0) == 0)
        .map(info)
        .collect();
    orphans.sort_by(|a, b| a.rel.to_lowercase().cmp(&b.rel.to_lowercase()));

    let mut recents: Vec<NoteInfo> = files.iter().map(info).collect();
    recents.sort_by(|a, b| b.modified.cmp(&a.modified));
    recents.truncate(if recent_limit == 0 { 25 } else { recent_limit });

    Ok(VaultInsights { orphans, recents, total: files.len() })
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

// ==================== PRISMA: anexar mídia (lê o DAM read-only) ====================

/// Caminho do banco do PRISMA (%APPDATA%\com.paulo.prisma\prisma.db).
fn prisma_db_file() -> Option<PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    let p = Path::new(&appdata).join("com.paulo.prisma").join("prisma.db");
    if p.exists() {
        Some(p)
    } else {
        None
    }
}

/// Há um banco do PRISMA legível neste computador?
#[tauri::command]
pub fn prisma_db_present() -> bool {
    prisma_db_file().is_some()
}

#[derive(Serialize, Clone)]
pub struct PrismaAsset {
    pub id: i64,
    pub path: String,
    pub filename: String,
    pub ext: String,
    pub kind: String, // type no banco (video/image/audio/...)
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    pub width: Option<i64>,
    pub height: Option<i64>,
}

/// Busca assets no banco do PRISMA (read-only, seguro mesmo com o PRISMA aberto).
/// `query` vazio = mais recentes. Filtra a lixeira (trashed=0).
#[tauri::command]
pub fn prisma_search_assets(query: String, limit: i64) -> Result<Vec<PrismaAsset>, String> {
    let db = prisma_db_file().ok_or("Banco do PRISMA não encontrado")?;
    let conn = rusqlite::Connection::open_with_flags(
        &db,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_URI,
    )
    .map_err(|e| format!("Não foi possível abrir o banco do PRISMA: {e}"))?;

    let lim = limit.clamp(1, 200);
    let q = query.trim().to_lowercase();
    let sql = "SELECT id, path, filename, ext, type, thumbnail_path, duration, width, height \
               FROM assets \
               WHERE COALESCE(trashed,0)=0 AND (?1='' OR LOWER(filename) LIKE '%'||?1||'%') \
               ORDER BY modified_at DESC LIMIT ?2";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![q, lim], |r| {
            // Colunas de texto toleram NULL (não derruba a linha silenciosamente).
            Ok(PrismaAsset {
                id: r.get(0)?,
                path: r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                filename: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                ext: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                kind: r.get::<_, Option<String>>(4)?.unwrap_or_default(),
                thumbnail: r.get::<_, Option<String>>(5)?,
                duration: r.get::<_, Option<f64>>(6)?,
                width: r.get::<_, Option<i64>>(7)?,
                height: r.get::<_, Option<i64>>(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::new();
    for row in rows {
        if let Ok(a) = row {
            out.push(a);
        }
    }
    Ok(out)
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
        let _ = fs::write(
            &gi,
            ".quartzo/canvas-assets/\n.quartzo/proxies/\n.DS_Store\nThumbs.db\n",
        );
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

/// Salva uma versão SÓ dos arquivos escolhidos (git add <files> + commit -- <files>).
/// Se `files` vier vazio, salva tudo (equivale ao git_commit). Os caminhos são
/// relativos ao vault. Retorna a saída do commit.
#[tauri::command]
pub fn git_commit_files(
    vault: String,
    message: String,
    files: Vec<String>,
) -> Result<String, String> {
    let msg = if message.trim().is_empty() {
        "Versão do Quartzo".to_string()
    } else {
        message
    };
    // Sem seleção (ou tudo selecionado) → salva tudo, igual ao git_commit.
    if files.is_empty() {
        run_git(&vault, &["add", "-A"])?;
        return run_git(&vault, &["commit", "-m", &msg]);
    }
    // Prepara os caminhos só dos escolhidos (inclui adições, edições e remoções).
    let mut add_args: Vec<&str> = vec!["add", "-A", "--"];
    for f in &files {
        add_args.push(f.as_str());
    }
    run_git(&vault, &add_args)?;
    // Commit limitado aos caminhos escolhidos (ignora o que houver staged fora deles).
    let mut commit_args: Vec<&str> = vec!["commit", "-m", &msg, "--"];
    for f in &files {
        commit_args.push(f.as_str());
    }
    run_git(&vault, &commit_args)
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

/// Diff de UM arquivo (trabalho vs HEAD). Para arquivos novos (não versionados)
/// devolve uma visão sintética com todas as linhas como adições.
#[tauri::command]
pub fn git_diff(vault: String, file: String) -> Result<String, String> {
    // arquivo versionado?
    let tracked = run_git(&vault, &["ls-files", "--error-unmatch", "--", &file]).is_ok();
    if tracked {
        let out = run_git(
            &vault,
            &["-c", "core.quotepath=false", "diff", "HEAD", "--", &file],
        )?;
        if out.trim().is_empty() {
            // pode estar só staged (ex.: já passou add -A): tenta o índice
            let staged = run_git(
                &vault,
                &["-c", "core.quotepath=false", "diff", "--cached", "--", &file],
            )
            .unwrap_or_default();
            return Ok(staged);
        }
        return Ok(out);
    }
    // novo arquivo: mostra como adição inteira
    let full = Path::new(&vault).join(&file);
    match fs::read_to_string(&full) {
        Ok(content) => {
            let mut s = format!("--- /dev/null\n+++ b/{file}\n");
            for line in content.lines() {
                s.push('+');
                s.push_str(line);
                s.push('\n');
            }
            Ok(s)
        }
        Err(_) => Ok(String::new()),
    }
}

#[derive(Serialize, Clone)]
pub struct GitRemote {
    pub has_remote: bool,
    pub url: String,
    pub has_upstream: bool,
    pub ahead: u32,
    pub behind: u32,
}

/// Info do remoto: URL do origin + quantos commits à frente/atrás do upstream.
#[tauri::command]
pub fn git_remote(vault: String) -> Result<GitRemote, String> {
    let url = run_git(&vault, &["remote", "get-url", "origin"])
        .unwrap_or_default()
        .trim()
        .to_string();
    let has_remote = !url.is_empty();
    // ahead/behind vs upstream (@{u}); se não houver upstream, dá erro → 0/0.
    let mut ahead = 0u32;
    let mut behind = 0u32;
    let mut has_upstream = false;
    if let Ok(out) = run_git(&vault, &["rev-list", "--left-right", "--count", "@{u}...HEAD"]) {
        let nums: Vec<&str> = out.split_whitespace().collect();
        if nums.len() == 2 {
            behind = nums[0].parse().unwrap_or(0);
            ahead = nums[1].parse().unwrap_or(0);
            has_upstream = true;
        }
    }
    Ok(GitRemote { has_remote, url, has_upstream, ahead, behind })
}

/// Envia commits ao remoto (git push). Se não houver upstream, define -u origin <branch>.
#[tauri::command]
pub fn git_push(vault: String) -> Result<String, String> {
    // tem upstream?
    if run_git(&vault, &["rev-parse", "--abbrev-ref", "@{u}"]).is_ok() {
        run_git(&vault, &["push"])
    } else {
        let branch = run_git(&vault, &["rev-parse", "--abbrev-ref", "HEAD"])
            .unwrap_or_default()
            .trim()
            .to_string();
        let branch = if branch.is_empty() { "main".to_string() } else { branch };
        run_git(&vault, &["push", "-u", "origin", &branch])
    }
}

/// Traz commits do remoto (git pull --no-edit, rebase pra evitar merges feios).
#[tauri::command]
pub fn git_pull(vault: String) -> Result<String, String> {
    run_git(&vault, &["pull", "--no-edit", "--rebase"])
}

// ==================== PROXY DE VÍDEO (ffmpeg) ====================

fn fnv1a(s: &str) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

/// ffmpeg está disponível no PATH do sistema?
#[tauri::command]
pub fn ffmpeg_available() -> bool {
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-version");
    no_window(&mut cmd);
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

/// Gera (ou reaproveita) um proxy H.264 720p do vídeo para tocar no WebView.
/// Salva em `<vault>/.quartzo/proxies/<hash>.mp4` e devolve o caminho absoluto.
#[tauri::command]
pub fn make_video_proxy(vault: String, src: String) -> Result<String, String> {
    let dir = Path::new(&vault).join(".quartzo").join("proxies");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let out = dir.join(format!("{:016x}.mp4", fnv1a(&src)));
    if out.exists() {
        return Ok(out.to_string_lossy().to_string());
    }
    let mut cmd = Command::new("ffmpeg");
    cmd.args([
        "-y",
        "-i",
        &src,
        "-vf",
        "scale=-2:720",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
    ])
    .arg(&out);
    no_window(&mut cmd);
    let res = cmd
        .output()
        .map_err(|e| format!("ffmpeg não encontrado no sistema: {e}"))?;
    if res.status.success() {
        Ok(out.to_string_lossy().to_string())
    } else {
        let _ = fs::remove_file(&out);
        let err = String::from_utf8_lossy(&res.stderr);
        Err(err.lines().last().unwrap_or("erro no ffmpeg").trim().to_string())
    }
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

// ---- Notas duplicadas (mesmo conteúdo) ----

#[derive(Serialize, Clone)]
pub struct DupFile {
    pub path: String,
    pub name: String,
    pub rel: String,
    pub modified: u64,
}
#[derive(Serialize, Clone)]
pub struct DupGroup {
    pub key: String,
    pub size: u64,
    pub empty: bool,
    pub files: Vec<DupFile>,
}

/// Acha grupos de notas .md com **conteúdo idêntico** (duplicatas reais — ex.: a
/// mesma nota adicionada 2×). Normaliza CRLF→LF e tira espaços/linhas no fim antes
/// de comparar. Retorna só grupos com 2+ arquivos, mais cópias primeiro.
#[tauri::command]
pub fn find_duplicate_notes(vault: String) -> Result<Vec<DupGroup>, String> {
    use std::collections::HashMap;
    let root = Path::new(&vault);
    let mut files = Vec::new();
    collect_md(root, &mut files);

    let mut groups: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    let mut sizes: HashMap<u64, usize> = HashMap::new();
    for p in &files {
        let Ok(content) = fs::read_to_string(p) else { continue };
        let normalized = content.replace("\r\n", "\n");
        let normalized = normalized.trim_end();
        let h = fnv1a(normalized);
        sizes.insert(h, normalized.len());
        groups.entry(h).or_default().push(p.clone());
    }

    let mut out: Vec<DupGroup> = Vec::new();
    for (h, paths) in groups {
        if paths.len() < 2 {
            continue;
        }
        let size = *sizes.get(&h).unwrap_or(&0) as u64;
        let mut dup_files: Vec<DupFile> = paths
            .iter()
            .map(|p| {
                let modified = fs::metadata(p)
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                let rel = p
                    .strip_prefix(root)
                    .unwrap_or(p)
                    .to_string_lossy()
                    .replace('\\', "/");
                DupFile {
                    path: p.to_string_lossy().to_string(),
                    name: p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
                    rel,
                    modified,
                }
            })
            .collect();
        // mais antigo primeiro (sugere manter o original e remover as cópias novas)
        dup_files.sort_by(|a, b| a.modified.cmp(&b.modified));
        out.push(DupGroup {
            key: format!("{h:x}"),
            size,
            empty: size == 0,
            files: dup_files,
        });
    }
    out.sort_by(|a, b| b.files.len().cmp(&a.files.len()));
    Ok(out)
}

fn is_word_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

// ---- Relink: achar um arquivo (por nome) p/ corrigir link quebrado ----

fn scan_dir_for(dir: &Path, target_lc: &str, out: &mut Vec<String>, seen: &mut HashSet<String>, depth: usize) {
    if depth > 6 || out.len() >= 100 {
        return;
    }
    let rd = match fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return,
    };
    for entry in rd.flatten() {
        if out.len() >= 100 {
            return;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.')
            || name.eq_ignore_ascii_case("node_modules")
            || name.eq_ignore_ascii_case("target")
            || name.eq_ignore_ascii_case("$RECYCLE.BIN")
            || name.eq_ignore_ascii_case("AppData")
        {
            continue;
        }
        let p = entry.path();
        if p.is_dir() {
            scan_dir_for(&p, target_lc, out, seen, depth + 1);
        } else if name.to_lowercase() == target_lc {
            let full = p.to_string_lossy().to_string();
            if seen.insert(full.clone()) {
                out.push(full);
            }
        }
    }
}

/// Procura um arquivo por NOME exato no vault + pastas comuns do usuário
/// (Desktop, Documentos, Downloads, Imagens, Vídeos). Cap 100, profundidade 6.
#[tauri::command]
pub fn scan_for_file(filename: String, vault: Option<String>) -> Result<Vec<String>, String> {
    let target = filename.trim().to_lowercase();
    if target.is_empty() {
        return Ok(vec![]);
    }
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Some(v) = vault {
        roots.push(PathBuf::from(v));
    }
    if let Ok(up) = std::env::var("USERPROFILE") {
        for d in ["Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music"] {
            roots.push(Path::new(&up).join(d));
        }
    }
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for root in roots {
        scan_dir_for(&root, &target, &mut out, &mut seen, 0);
        if out.len() >= 100 {
            break;
        }
    }
    Ok(out)
}

/// Copia um arquivo externo para `<vault>/attachments/` e devolve o NOME final
/// (para embutir por nome). Evita sobrescrever adicionando sufixo (1), (2)…
#[tauri::command]
pub fn import_attachment(vault: String, src: String) -> Result<String, String> {
    let src_p = Path::new(&src);
    if !src_p.is_file() {
        return Err("Arquivo de origem não encontrado".into());
    }
    let fname = src_p
        .file_name()
        .ok_or("Arquivo inválido")?
        .to_string_lossy()
        .to_string();
    let dir = Path::new(&vault).join("attachments");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let stem = src_p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let ext = src_p.extension().map(|s| s.to_string_lossy().to_string());
    let mut dest = dir.join(&fname);
    let mut final_name = fname.clone();
    let mut n = 1;
    while dest.exists() {
        final_name = match &ext {
            Some(e) => format!("{stem} ({n}).{e}"),
            None => format!("{stem} ({n})"),
        };
        dest = dir.join(&final_name);
        n += 1;
    }
    fs::copy(&src, &dest).map_err(|e| e.to_string())?;
    Ok(final_name)
}

/// Converte menções não-linkadas: numa nota, envolve as ocorrências (palavra
/// inteira) de `target_name` em `[[ ]]`, pulando wikilinks e código já existentes.
/// Retorna quantas foram linkadas.
#[tauri::command]
pub fn link_mention(path: String, target_name: String) -> Result<u32, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let chars: Vec<char> = content.chars().collect();
    let lower: Vec<char> = content.to_lowercase().chars().collect();
    let needle: Vec<char> = target_name.to_lowercase().chars().collect();
    let nlen = needle.len();
    if nlen == 0 {
        return Ok(0);
    }
    let mut out = String::with_capacity(content.len() + 8);
    let mut i = 0;
    let mut count = 0u32;
    while i < chars.len() {
        // pula wikilinks [[...]]
        if chars[i] == '[' && i + 1 < chars.len() && chars[i + 1] == '[' {
            out.push_str("[[");
            i += 2;
            while i < chars.len() {
                if chars[i] == ']' && i + 1 < chars.len() && chars[i + 1] == ']' {
                    out.push_str("]]");
                    i += 2;
                    break;
                }
                out.push(chars[i]);
                i += 1;
            }
            continue;
        }
        // pula bloco de código ```...```
        if chars[i] == '`' && i + 2 < chars.len() && chars[i + 1] == '`' && chars[i + 2] == '`' {
            out.push_str("```");
            i += 3;
            while i < chars.len() {
                if chars[i] == '`' && i + 2 < chars.len() && chars[i + 1] == '`' && chars[i + 2] == '`' {
                    out.push_str("```");
                    i += 3;
                    break;
                }
                out.push(chars[i]);
                i += 1;
            }
            continue;
        }
        // pula código inline `...`
        if chars[i] == '`' {
            out.push('`');
            i += 1;
            while i < chars.len() && chars[i] != '`' {
                out.push(chars[i]);
                i += 1;
            }
            continue;
        }
        // casa a palavra inteira (case-insensitive)
        if i + nlen <= chars.len() && lower[i..i + nlen] == needle[..] {
            let before_ok = i == 0 || !is_word_char(chars[i - 1]);
            let after_ok = i + nlen >= chars.len() || !is_word_char(chars[i + nlen]);
            if before_ok && after_ok {
                out.push_str("[[");
                for c in &chars[i..i + nlen] {
                    out.push(*c);
                }
                out.push_str("]]");
                i += nlen;
                count += 1;
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    if count > 0 {
        fs::write(&path, out).map_err(|e| e.to_string())?;
    }
    Ok(count)
}

// ---- Renomear nota atualizando os [[wikilinks]] que apontam pra ela ----

/// Reescreve o miolo de um wikilink ([[alvo|alias#h]]) trocando o stem antigo
/// pelo novo, preservando pasta, alias e heading. Retorna o miolo (alterado ou não).
fn rewrite_inner(inner: &str, old_stem_lc: &str, new_stem: &str) -> String {
    let (target_part, rest) = match inner.find('|') {
        Some(p) => (&inner[..p], &inner[p..]), // rest inclui "|alias"
        None => (inner, ""),
    };
    let (path_part, heading) = match target_part.find('#') {
        Some(p) => (&target_part[..p], &target_part[p..]),
        None => (target_part, ""),
    };
    let norm = path_part.trim().replace('\\', "/");
    let (dir, last) = match norm.rfind('/') {
        Some(p) => (norm[..=p].to_string(), norm[p + 1..].to_string()),
        None => (String::new(), norm.clone()),
    };
    let last_stem = if last.to_lowercase().ends_with(".md") {
        &last[..last.len() - 3]
    } else {
        &last[..]
    };
    if last_stem.to_lowercase() == old_stem_lc {
        format!("{dir}{new_stem}{heading}{rest}")
    } else {
        inner.to_string()
    }
}

/// Varre o conteúdo e reescreve todos os [[...]] / ![[...]] que apontam pro stem antigo.
fn rewrite_wikilinks(content: &str, old_stem_lc: &str, new_stem: &str) -> (String, bool) {
    let mut out = String::with_capacity(content.len());
    let mut i = 0;
    let mut changed = false;
    while i < content.len() {
        if content[i..].starts_with("[[") {
            if let Some(rel) = content[i + 2..].find("]]") {
                let inner = &content[i + 2..i + 2 + rel];
                if !inner.contains('\n') {
                    let new_inner = rewrite_inner(inner, old_stem_lc, new_stem);
                    if new_inner != inner {
                        changed = true;
                    }
                    out.push_str("[[");
                    out.push_str(&new_inner);
                    out.push_str("]]");
                    i += 2 + rel + 2;
                    continue;
                }
            }
        }
        let ch = content[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }
    (out, changed)
}

#[derive(Serialize, Clone)]
pub struct RenameNoteResult {
    pub new_path: String,
    pub updated: u32,
}

/// Renomeia uma nota (.md) E atualiza todos os wikilinks do vault que a citavam.
#[tauri::command]
pub fn rename_note(vault: String, path: String, new_name: String) -> Result<RenameNoteResult, String> {
    let p = Path::new(&path);
    let parent = p.parent().ok_or("Sem pasta pai")?;
    let old_stem = stem(p);
    let safe = sanitize_filename(&new_name);
    if safe.is_empty() {
        return Err("Nome inválido".into());
    }
    let final_name = if safe.to_lowercase().ends_with(".md") {
        safe.clone()
    } else {
        format!("{safe}.md")
    };
    let dest = parent.join(&final_name);
    if dest != p && dest.exists() {
        return Err("Já existe um item com esse nome".into());
    }
    fs::rename(p, &dest).map_err(|e| e.to_string())?;
    let new_stem = stem(&dest);

    // Atualiza os links em todas as notas do vault.
    let old_lc = old_stem.to_lowercase();
    let mut files = Vec::new();
    collect_md(Path::new(&vault), &mut files);
    let mut updated = 0u32;
    for f in &files {
        let content = match fs::read_to_string(f) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let (new_content, changed) = rewrite_wikilinks(&content, &old_lc, &new_stem);
        if changed && fs::write(f, new_content).is_ok() {
            updated += 1;
        }
    }
    Ok(RenameNoteResult {
        new_path: dest.to_string_lossy().to_string(),
        updated,
    })
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
