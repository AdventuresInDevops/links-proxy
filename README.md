<p align="center">
  <img src="https://authress.io/static/images/linkedin-banner.png" alt="Authress media banner">
</p>

# Authress Knowledge Base

<p align="center">
    <a href="./LICENSE" alt="Apache-2.0"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"></a>
    <a href="https://authress.io/community" alt="authress community"><img src="https://img.shields.io/badge/Community-Authress-fbaf0b.svg"></a>
</p>

This is the source code for the [Authress Knowledge Base](https://authress.io/knowledge-base/docs/category/introduction).

## Technology

* [NodeJS](https://nodejs.org/) - Runtime
  * Recommendation [nvm](https://github.com/creationix/nvm) to install
* [Yarn](https://yarnpkg.com/en/) - Package Manager

## Authoring Articles
Keep this in mind: [How to write documentation - diataxis](https://diataxis.fr/)

## Development

### Running server locally
* run `yarn` (every time the package manifest changes, unlikely)
* run `yarn start`

### Building Production version
* `yarn`
* `yarn build`

### Overwriting the theme
To add something to a page or content, find the relevant react component generating that content from ./node_modules/@docusaurus/theme-classic/src/theme/ and copy that directory into the /src/theme directory.

### Front matter options
https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-blog#markdown-front-matter

### TODO:
* Replace bad top level links with: `pathname:///knowledge-base/whole path` instead: https://docusaurus.io/docs/advanced/routing
* search: https://docusaurus.io/community/resources#search
* Add * og:image image meta overrides to doc pages

## Rust Lambda Development
[See Internal Authress kb-processor](https://gitlab.com/rhosys/authress/kb-processor)

## Troubleshooting
If you get a page not found when running `yarn start` for a linked page:
* Check to make sure that page is in the same hierarchy, you can't link from docs => articles, it must start with /knowledge-base in those cases
* If it is in the same hierarchy, then run `yarn build` and fix the errors that show up, sometimes there are issues that `yarn start` doesn't catch.


## Some tricks

```js
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
console.log('****', useDocusaurusContext());

import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

/**
 * Get the pathname of current route, without the optional site baseUrl.
 * - `/docs/myDoc` => `/docs/myDoc`
 * - `/baseUrl/docs/myDoc` => `/docs/myDoc`
 */
export function useLocalPathname(): string {
  const {
    siteConfig: {baseUrl},
  } = useDocusaurusContext();
  const {pathname} = useLocation();
  return pathname.replace(baseUrl, '/');
}
```

## Notes while migrating to future version of docusaurus
* Make sure all plugins work