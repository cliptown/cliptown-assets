# cliptown-assets
Versioned product images, CSS, CDN exports, and static assets; app branding is isolated from marketing sites.


## Machine-readable asset registry

`branding/manifest.json` lists versioned, repository-relative asset paths with
stable IDs and media types. Consumers should treat the assets in Git as the
source of truth, pin a reviewed commit, and never resolve a floating CDN URL.
The registry is validated against `branding/manifest.schema.json` and starts
with `branding/app-logo.png`; it does not claim a published release or CDN.
