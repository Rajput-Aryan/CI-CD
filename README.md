[![Pipeline](https://github.com/Rajput-Aryan/CI-CD/actions/workflows/pipeline.yml/badge.svg)](https://github.com/Rajput-Aryan/CI-CD/actions/workflows/pipeline.yml)

## How This Site is Deployed

This portfolio site uses a fully automated CI/CD pipeline:

1. **Every push to `main`** triggers GitHub Actions to run automated checks
2. **Checks include**: HTML validation and broken link detection
3. **If all checks pass** ✅ → Vercel automatically deploys the site
4. **If any check fails** ❌ → Deployment is blocked until the issue is fixed

The green badge above shows the current pipeline status. Click it to see the detailed workflow runs.

### The Pipeline in Action

- **Branch protection**: All code must pass checks before merging to `main`
- **Deploy hooks**: Only GitHub Actions can trigger production deploys (manual pushes don't deploy)
- **Automated checks**: HTML validation and link checking catch issues before they go live
