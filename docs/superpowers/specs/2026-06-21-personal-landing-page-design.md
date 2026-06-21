# Personal Landing Page Design

## Goal

Create a very simple personal website landing page for Mateusz Rembiasz.
The page should say hello and link to the provided social profiles:

- LinkedIn: https://www.linkedin.com/in/mateusz-rembiasz/
- GitLab: https://gitlab.mrembiasz.pl/kerbatek
- GitHub: https://github.com/kerbatek

## Approach

Use a dependency-free static site:

- `index.html` for semantic page structure.
- `styles.css` for presentation.
- No JavaScript, build tooling, analytics, or external assets.

This keeps the site easy to host from any static web server or GitLab Pages-style deployment.

## Page Content

The first screen contains:

- A short greeting: "Hello, I'm Mateusz Rembiasz."
- One concise supporting sentence.
- Three visible links: LinkedIn, GitLab, GitHub.

## Visual Direction

The design is intentionally restrained:

- Centered single-page composition.
- Light background, dark readable text, subtle accent color.
- Comfortable spacing and clear focus states.
- Responsive layout that works on mobile and desktop.

## Error Handling

There is no runtime application logic. Links open directly to the provided URLs. External links use standard security attributes.

## Verification

Verify by opening `index.html` in a browser or serving the directory statically, then checking:

- The greeting is visible.
- All three links render and point to the expected URLs.
- The page remains readable at mobile and desktop widths.
