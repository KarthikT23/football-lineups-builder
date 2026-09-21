// Static export config, so `next build` produces a plain `out/` folder of
// static files that GitHub Pages (or any static host) can serve directly.
//
// NEXT_PUBLIC_BASE_PATH is set by the GitHub Actions workflow to `/<repo-name>`
// when deploying to https://<user>.github.io/<repo-name>/. Leave it unset for
// local dev, a custom domain, or a user/organization page (https://<user>.github.io/).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  images: { unoptimized: true }, // next/image's optimizer needs a server; static export has none
  trailingSlash: true,
};

export default nextConfig;
