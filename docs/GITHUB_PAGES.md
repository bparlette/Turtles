GitHub Pages: Settings > Pages > Deploy from a branch. Pages can only serve the repo root or /docs,
so either (a) push the contents of game/ to a gh-pages branch:
    git subtree push --prefix game origin gh-pages
or (b) use a GitHub Action that uploads ./game as the Pages artifact.
