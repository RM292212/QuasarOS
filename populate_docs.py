import os
import sys
import re

def read_file_with_fallback_encoding(path):
    encodings = ["utf-8-sig", "utf-8", "utf-16", "utf-16-le", "utf-16-be", "latin-1", "cp1252"]
    for enc in encodings:
        try:
            with open(path, "r", encoding=enc) as f:
                content = f.read()
                return content
        except Exception:
            continue
    raise RuntimeError(f"Failed to decode {path} with any standard encoding.")

def build_repo_file_map(base_dir="."):
    repo_files = {}
    for root, dirs, files in os.walk(base_dir):
        if ".git" in root:
            continue
        for file in files:
            if file.endswith(".md") and not file.startswith("raw"):
                rel = os.path.relpath(os.path.join(root, file), base_dir).replace("\\", "/")
                repo_files[file.lower()] = rel
                base_name = file[:-3].lower() if file.endswith(".md") else file.lower()
                repo_files[base_name] = rel
                adr_match = re.match(r"(adr-\d+)", file.lower())
                if adr_match:
                    repo_files[adr_match.group(1)] = rel

    # Evidence directory specific readmes
    evidence_mapping = {
        "api reports": "docs/11-evidence/API-reports/README.md",
        "benchmarks": "docs/11-evidence/benchmarks/README.md",
        "browser recordings": "docs/11-evidence/browser-recordings/README.md",
        "licence reports": "docs/11-evidence/licence-reports/README.md",
        "release reports": "docs/11-evidence/release-reports/README.md",
        "scientific validation": "docs/11-evidence/scientific-validation/README.md",
        "screenshots": "docs/11-evidence/screenshots/README.md",
        "security reports": "docs/11-evidence/security-reports/README.md",
        "visual regressions": "docs/11-evidence/visual-regressions/README.md"
    }
    repo_files.update(evidence_mapping)

    return repo_files

def resolve_target_file(block, repo_file_map):
    file_match = re.search(r"\*\*File:\*\*\s*`?([^`\r\n]+)`?", block)
    if not file_match:
        file_match = re.search(r"File:\s*`?([^`\r\n]+)`?", block)
    if file_match:
        candidate = file_match.group(1).strip().strip("`")
        if candidate.endswith(".md") or "/" in candidate or "\\" in candidate:
            return candidate

    adr_search = re.search(r"(ADR-\d+)", block[:300], re.IGNORECASE)
    if adr_search:
        key = adr_search.group(1).lower()
        if key in repo_file_map:
            return repo_file_map[key]

    lines = [l.strip() for l in block.strip().split("\n") if l.strip()]
    for line in lines[:5]:
        if line.startswith("#"):
            title = line.lstrip("#").strip().strip("`")
            title_lower = title.lower()
            
            if title_lower in repo_file_map:
                return repo_file_map[title_lower]
                
            if "architecture decision records" in title_lower:
                return "docs/10-decisions/README.md"
                
            title_clean = re.sub(r"[^a-z0-9]", "", title_lower)
            for k, v in repo_file_map.items():
                k_clean = re.sub(r"[^a-z0-9]", "", k)
                if title_clean == k_clean or title_clean + "md" == k_clean:
                    return v

    return None

def populate_files(raw_file_path="raw.md", base_dir="."):
    if not os.path.exists(raw_file_path):
        print(f"Error: {raw_file_path} not found.")
        sys.exit(1)

    text = read_file_with_fallback_encoding(raw_file_path)
    repo_file_map = build_repo_file_map(base_dir)

    pattern = r"```markdown\r?\n(.*?)\r?\n```"
    matches = re.findall(pattern, text, re.DOTALL)
    
    parsed_files = {}

    if matches:
        print(f"Found {len(matches)} markdown code blocks.")
        for idx, block in enumerate(matches):
            target_path = resolve_target_file(block, repo_file_map)

            if target_path:
                content = block.strip() + "\n"
                parsed_files[target_path] = content
            else:
                first_line = block.strip().split("\n")[0] if block.strip() else "EMPTY"
                print(f"Warning: Could not determine target path for block {idx+1} (Header: {first_line})")
    else:
        print("No ```markdown blocks found. Trying fallback split on headers...")
        file_splits = re.split(r"(?=\n# [^\n]+)", text)
        for segment in file_splits:
            segment = segment.strip()
            if not segment:
                continue
            target_path = resolve_target_file(segment, repo_file_map)
            if target_path:
                parsed_files[target_path] = segment + "\n"

    print(f"Total target files identified: {len(parsed_files)}")

    updated_count = 0
    created_count = 0

    for rel_path, content in parsed_files.items():
        rel_path = rel_path.replace("\\", "/").lstrip("/")
        full_path = os.path.join(base_dir, rel_path)
        
        parent_dir = os.path.dirname(full_path)
        if parent_dir and not os.path.exists(parent_dir):
            os.makedirs(parent_dir, exist_ok=True)
            
        file_existed = os.path.exists(full_path)
        
        with open(full_path, "w", encoding="utf-8") as out_f:
            out_f.write(content)
            
        if file_existed:
            updated_count += 1
            print(f"[UPDATED] {rel_path}")
        else:
            created_count += 1
            print(f"[CREATED] {rel_path}")

    print(f"\nDone! Updated: {updated_count}, Created: {created_count}, Total: {len(parsed_files)}")

if __name__ == "__main__":
    raw_path = sys.argv[1] if len(sys.argv) > 1 else "raw.md"
    populate_files(raw_path)
