# Personal Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a very simple static personal landing page for Mateusz Rembiasz with links to LinkedIn, GitLab, and GitHub.

**Architecture:** Use plain static files with no build step. `index.html` owns semantic content and metadata. `styles.css` owns visual presentation and responsive behavior.

**Tech Stack:** HTML, CSS, Python stdlib verification script.

---

## File Structure

- Create `index.html`: semantic landing page structure, greeting, social links, metadata.
- Create `styles.css`: centered responsive visual styling, focus states, hover states.
- Create `tests/check_site.py`: static verifier for expected files, content, and social links.
- Modify `README.md`: replace the generated GitLab scaffold with short project usage notes.

### Task 1: Static Site Verification

**Files:**
- Create: `tests/check_site.py`
- Later verifies: `index.html`, `styles.css`

- [ ] **Step 1: Write the failing test**

```python
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        self.links.append(dict(attrs))


def test_site_files_and_links():
    index = ROOT / "index.html"
    css = ROOT / "styles.css"

    assert index.exists(), "index.html should exist"
    assert css.exists(), "styles.css should exist"

    html = index.read_text(encoding="utf-8")
    assert "Hello, I'm Mateusz Rembiasz." in html
    assert 'href="styles.css"' in html

    parser = LinkParser()
    parser.feed(html)
    hrefs = {link.get("href") for link in parser.links}

    assert "https://www.linkedin.com/in/mateusz-rembiasz/" in hrefs
    assert "https://gitlab.mrembiasz.pl/kerbatek" in hrefs
    assert "https://github.com/kerbatek" in hrefs

    external_links = [link for link in parser.links if link.get("href", "").startswith("https://")]
    assert external_links
    for link in external_links:
        assert link.get("target") == "_blank"
        assert link.get("rel") == "noreferrer"


if __name__ == "__main__":
    test_site_files_and_links()
    print("site checks passed")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 tests/check_site.py`
Expected: FAIL because `index.html` and `styles.css` do not exist yet.

### Task 2: Landing Page Files

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Modify: `README.md`

- [ ] **Step 1: Write minimal implementation**

Create the static HTML and CSS with the agreed greeting, supporting line, and social links. Replace README scaffold with brief local usage.

- [ ] **Step 2: Run test to verify it passes**

Run: `python3 tests/check_site.py`
Expected: PASS with `site checks passed`.

- [ ] **Step 3: Inspect final files**

Run: `git status --short`
Expected: changed files are limited to docs, tests, `index.html`, `styles.css`, and `README.md`.
