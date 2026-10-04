// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://monoswan.com",
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Forum",
      cssVariable: "--font-forum",
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/Forum-Regular.ttf"],
            weight: "normal",
            style: "normal",
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "DepartureMono",
      cssVariable: "--font-departure-mono",
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/DepartureMono-Regular.woff2"],
            weight: "normal",
            style: "normal",
          },
        ],
      },
    },
  ],
  integrations: [
    starlight({
      favicon: "favicon.png",
      title: "monoswan",
      description: "Keep package configuration consistent across a monorepo.",
      disable404Route: true,
      credits: false,
      components: {
        Footer: "./src/components/docs-footer.astro",
      },
      head: [
        { tag: "meta", attrs: { property: "og:site_name", content: "monoswan" } },
        { tag: "meta", attrs: { property: "og:type", content: "website" } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary" } },
      ],
      logo: {
        src: "./src/assets/monoswan3.png",
        replacesTitle: true,
      },
      customCss: ["./src/styles/docs.css", "./src/styles/global.css"],
      social: [
        { icon: "npm", label: "monoswan on npmx", href: "https://npmx.dev/monoswan" },
        { icon: "github", label: "GitHub", href: "https://github.com/pelicanonical/monoswan" },
      ],
      sidebar: [
        { label: "Introduction", link: "/docs/" },
        { label: "Quick start", link: "/docs/quick-start/" },
        {
          label: "Configuration",
          items: [
            { label: "Overview", link: "/docs/configuration/" },
            { label: "Variants", link: "/docs/configuration/variants/" },
            {
              label: "Package templates",
              link: "/docs/configuration/package-templates/",
            },
          ],
        },
        {
          label: "Linting",
          items: [
            { label: "Overview", link: "/docs/linting/" },
            { label: "Built-in rules", link: "/docs/linting/built-in/" },
            { label: "Custom rules", link: "/docs/linting/custom/" },
          ],
        },
        {
          label: "Reference",
          items: [
            {
              label: "monoswan.config.ts",
              link: "/docs/configuration/root-reference/",
            },
            {
              label: "Variants and files",
              link: "/docs/configuration/variant-files/",
            },
            {
              label: "Commands",
              items: [
                { label: "Overview", link: "/docs/commands/" },
                {
                  label: "create-package",
                  link: "/docs/commands/create-package/",
                },
                { label: "init", link: "/docs/commands/init/" },
                { label: "lint", link: "/docs/commands/lint/" },
                { label: "print-config", link: "/docs/commands/print-config/" },
              ],
            },
          ],
        },
      ],
    }),
  ],
});
