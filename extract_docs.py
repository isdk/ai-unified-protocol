import re
import os

source_file = "src/spec/sections.ts"
target_file = "src/spec/docs/en.md"

def parse_ts_file(content):
    lines = content.split('\n')
    sections = []

    current_section = None
    current_subsection = None

    # States
    STATE_ROOT = 0
    STATE_IN_SECTIONS_ARRAY = 1
    STATE_IN_SECTION = 2
    STATE_IN_SUBSECTIONS_ARRAY = 3
    STATE_IN_SUBSECTION = 4
    STATE_IN_CONTENT = 5
    STATE_IN_CODE = 6
    STATE_IN_NOTES = 7
    STATE_IN_DECISIONS = 8

    state = STATE_ROOT
    buffer = []

    def clean_str(s):
        # Remove trailing comma first
        s = s.strip().rstrip(',')
        # Remove quotes
        if s.startswith("'") and s.endswith("'"):
            return s[1:-1]
        if s.startswith('"') and s.endswith('"'):
            return s[1:-1]
        return s

    for i, line in enumerate(lines):
        stripped = line.strip()

        if state == STATE_ROOT:
            if "export const specSections" in line:
                state = STATE_IN_SECTIONS_ARRAY

        elif state == STATE_IN_SECTIONS_ARRAY:
            if stripped == '{':
                current_section = {'subsections': []}
                state = STATE_IN_SECTION
            elif stripped == '];':
                state = STATE_ROOT

        elif state == STATE_IN_SECTION:
            if stripped.startswith('id:'):
                current_section['id'] = clean_str(stripped.split(':', 1)[1])
            elif stripped.startswith('title:'):
                current_section['title'] = clean_str(stripped.split(':', 1)[1])
            elif stripped.startswith('icon:'):
                current_section['icon'] = clean_str(stripped.split(':', 1)[1])
            elif stripped.startswith('subsections: ['):
                state = STATE_IN_SUBSECTIONS_ARRAY
            elif stripped == '},' or stripped == '}':
                sections.append(current_section)
                state = STATE_IN_SECTIONS_ARRAY

        elif state == STATE_IN_SUBSECTIONS_ARRAY:
            if stripped == '{':
                current_subsection = {}
                state = STATE_IN_SUBSECTION
            elif stripped == '],' or stripped == ']': # End of subsections
                state = STATE_IN_SECTION

        elif state == STATE_IN_SUBSECTION:
            if stripped.startswith('id:'):
                current_subsection['id'] = clean_str(stripped.split(':', 1)[1])
            elif stripped.startswith('title:'):
                current_subsection['title'] = clean_str(stripped.split(':', 1)[1])
            elif stripped.startswith('content: `'):
                content_val = line.split('content: `', 1)[1]
                if content_val.strip().endswith('`,') or (content_val.strip().endswith('`') and len(content_val.strip()) > 1):
                     # Single line content
                     current_subsection['content'] = content_val.rsplit('`', 1)[0]
                else:
                    buffer = [content_val]
                    state = STATE_IN_CONTENT

            elif stripped.startswith('code: `'):
                 code_val = line.split('code: `', 1)[1]
                 if code_val.strip().endswith('`,') or (code_val.strip().endswith('`') and len(code_val.strip()) > 1):
                     current_subsection['code'] = code_val.rsplit('`', 1)[0]
                 else:
                     buffer = [code_val]
                     state = STATE_IN_CODE

            elif stripped.startswith('notes: ['):
                current_subsection['notes'] = []
                state = STATE_IN_NOTES
            elif stripped.startswith('decisions: ['):
                current_subsection['decisions'] = []
                state = STATE_IN_DECISIONS

            elif stripped == '},' or stripped == '}':
                if current_section and 'subsections' in current_section:
                    current_section['subsections'].append(current_subsection)
                state = STATE_IN_SUBSECTIONS_ARRAY

        elif state == STATE_IN_CONTENT:
            # Check for end backtick
            # It could be ` at start of line, or `,
            if stripped.endswith('`,') or stripped == '`' or stripped == '`,':
                val = line.rstrip().rstrip(',').rstrip('`') # Preserve indentation on the left!
                # But wait, in TS template strings, indentation is preserved.
                # Does logic need to strip specific indentation? Usually not, raw string.
                # But here we are splitting by \n which preserves indentation.
                # The end backtick line usually has same indentation as start?
                # Let's just take the line content.
                if val: buffer.append(val)
                current_subsection['content'] = '\n'.join(buffer)
                state = STATE_IN_SUBSECTION
            else:
                buffer.append(line) # Keep full line to preserve indentation

        elif state == STATE_IN_CODE:
             if stripped.endswith('`,') or stripped == '`' or stripped == '`,':
                val = line.rstrip().rstrip(',').rstrip('`')
                if val: buffer.append(val)
                current_subsection['code'] = '\n'.join(buffer)
                # print(f"Captured code for {current_subsection.get('id')}")
                state = STATE_IN_SUBSECTION
             else:
                buffer.append(line)

        elif state == STATE_IN_NOTES:
            if stripped.startswith("'") or stripped.startswith('"'):
                val = stripped.strip().rstrip(',').strip("'").strip('"')
                current_subsection['notes'].append(val)
            elif stripped.startswith('],') or stripped == ']':
                state = STATE_IN_SUBSECTION

        elif state == STATE_IN_DECISIONS:
             if stripped.startswith("'") or stripped.startswith('"'):
                val = stripped.strip().rstrip(',').strip("'").strip('"')
                current_subsection['decisions'].append(val)
             elif stripped.startswith('],') or stripped == ']':
                state = STATE_IN_SUBSECTION

    return sections

def generate_markdown(sections):
    md = []

    for section in sections:
        title = section.get('title', 'Unknown')
        icon = section.get('icon', '')
        # Putting icon in title for now
        md.append(f"# {icon} {title}")
        md.append(f"<!-- id: {section.get('id', '')} -->\n")

        for sub in section.get('subsections', []):
            md.append(f"## {sub.get('title', 'Unknown')}")
            md.append(f"<!-- id: {sub.get('id', '')} -->\n")

            content = sub.get('content', '')
            if content:
                # Remove leading newlines if any, but keep internal structure
                md.append(content.strip() + "\n")

            code = sub.get('code', '')
            if code:
                md.append("```typescript") # Defaulting to typescript for highlighting (or text for diagrams)
                # If it looks like a diagram (lots of box drawing chars), maybe use 'text'?
                # checking for box chars
                if '┌' in code or '│' in code:
                     md.append("") # plain text/diagram
                elif 'interface ' in code or 'type ' in code:
                     # already printed typescript above? No, I need to check
                     pass # keep typescript
                else:
                     pass

                # Actually, let's just use `typescript` unless it's a diagram.
                # If I append `typescript` to ` ``` ` line:
                if '┌' in code or '│' in code:
                   md[-1] = "```text"

                md.append(code.strip())
                md.append("```\n")

            decisions = sub.get('decisions', [])
            if decisions:
                md.append("### Decisions")
                for d in decisions:
                    md.append(f"- {d}")
                md.append("")

            notes = sub.get('notes', [])
            if notes:
                md.append("### Notes")
                for n in notes:
                    md.append(f"- {n}")
                md.append("")

    return '\n'.join(md)

if __name__ == "__main__":
    with open(source_file, 'r', encoding='utf-8') as f:
        content = f.read()

    sections = parse_ts_file(content)
    md_content = generate_markdown(sections)

    os.makedirs(os.path.dirname(target_file), exist_ok=True)
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(md_content)

    print(f"Extracted {len(sections)} sections to {target_file}")
