from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.tags = []
        self.classes = []

    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        attr_map = dict(attrs)
        if "class" in attr_map:
            self.classes.extend(attr_map["class"].split())
        if tag != "a":
            return
        self.links.append(attr_map)


def test_site_files_and_links():
    index = ROOT / "index.html"
    css = ROOT / "styles.css"
    dockerfile = ROOT / "Dockerfile"
    nginx_conf = ROOT / "nginx.conf"
    dockerignore = ROOT / ".dockerignore"
    gitlab_ci = ROOT / ".gitlab-ci.yml"

    assert index.exists(), "index.html should exist"
    assert css.exists(), "styles.css should exist"
    assert dockerfile.exists(), "Dockerfile should exist"
    assert nginx_conf.exists(), "nginx.conf should exist"
    assert dockerignore.exists(), ".dockerignore should exist"
    assert gitlab_ci.exists(), ".gitlab-ci.yml should exist"

    html = index.read_text(encoding="utf-8")
    styles = css.read_text(encoding="utf-8")
    dockerfile_text = dockerfile.read_text(encoding="utf-8")
    nginx_text = nginx_conf.read_text(encoding="utf-8")
    dockerignore_text = dockerignore.read_text(encoding="utf-8")
    gitlab_ci_text = gitlab_ci.read_text(encoding="utf-8")
    assert "Mateusz Rembiasz" in html
    assert "Cloud &amp; DevOps" in html
    assert "Future systems engineer" not in html
    assert "Interests" in html
    assert "trainee" not in html.lower()
    assert "Krak" not in html
    assert "Focus" not in html
    assert "Linux administration" not in html
    assert "Linux and Networking Administration Practice" not in html
    assert 'href="styles.css"' in html

    parser = LinkParser()
    parser.feed(html)
    hrefs = {link.get("href") for link in parser.links}

    assert "container" in parser.classes
    assert "name" in parser.classes
    assert "status" in parser.classes
    assert "bio" in parser.classes
    assert "section-label" in parser.classes
    assert "section" in parser.classes
    assert "tags" in parser.classes
    assert "projects" in parser.classes
    assert "project" in parser.classes
    assert "social" in parser.classes
    assert "ul" not in parser.tags
    assert parser.tags.count("svg") == 4

    assert "https://www.linkedin.com/in/mateusz-rembiasz/" in hrefs
    assert "https://gitlab.mrembiasz.pl/kerbatek" in hrefs
    assert "https://github.com/kerbatek" in hrefs
    assert "mailto:mateusz@mrembiasz.pl" in hrefs

    external_links = [
        link for link in parser.links if link.get("href", "").startswith("https://")
    ]
    assert external_links
    for link in external_links:
        assert link.get("target") == "_blank"
        assert "noreferrer" in link.get("rel", "")

    expected_text = [
        "Systems engineering",
        "Kubernetes",
        "Cloud infrastructure",
        "Virtualization",
        "CI/CD",
        "GitOps",
        "Infrastructure automation",
        "Homelab Infrastructure Platform",
        "Kubernetes Learning Cluster",
        "CI/CD and Infrastructure Automation Practice",
        "Virtualization and Cloud Infrastructure Practice",
        "Proxmox",
        "MikroTik",
        "Terraform",
        "Ansible",
        "AWS",
        "Polish: Native",
        "English: C1",
    ]
    for text in expected_text:
        assert text in html

    assert "--bg: #18181b" in styles
    assert "--text: #e4e4e7" in styles
    assert "--muted: #c4c4ca" in styles
    assert "--border: #3f3f46" in styles
    assert "--hover-bg: #27272a" in styles
    assert ".container" in styles
    assert ".social a" in styles
    assert ".project" in styles
    assert ".tag" in styles
    assert "ui-monospace" in styles
    assert "Georgia" not in styles

    assert "FROM nginx:alpine" in dockerfile_text
    assert "COPY index.html /usr/share/nginx/html/index.html" in dockerfile_text
    assert "COPY styles.css /usr/share/nginx/html/styles.css" in dockerfile_text
    assert "COPY nginx.conf /etc/nginx/conf.d/default.conf" in dockerfile_text
    assert "EXPOSE 80" in dockerfile_text

    assert "listen 80" in nginx_text
    assert "root /usr/share/nginx/html" in nginx_text
    assert "try_files $uri $uri/ /index.html" in nginx_text

    for ignored in [".git", ".DS_Store", "docs", "tests"]:
        assert ignored in dockerignore_text

    assert "gcr.io/kaniko-project/executor" in gitlab_ci_text
    assert "--context \"$CI_PROJECT_DIR\"" in gitlab_ci_text
    assert "--dockerfile \"$CI_PROJECT_DIR/Dockerfile\"" in gitlab_ci_text
    assert "--destination \"$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\"" in gitlab_ci_text
    assert "--destination \"$CI_REGISTRY_IMAGE:latest\"" in gitlab_ci_text
    assert "docker:27-dind" not in gitlab_ci_text
    assert "DOCKER_HOST" not in gitlab_ci_text
    assert "if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'" in gitlab_ci_text


if __name__ == "__main__":
    test_site_files_and_links()
    print("site checks passed")
