import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://www.danielnewton.dev/",
    title: "Daniel Newton",
    description:
      "A blog covering web development, programming, and technology - featuring tutorials, insights, and experiments.",
    author: "Daniel Newton",
    profile: "https://www.danielnewton.dev/",
    ogImage: "default-og.jpg",
    lang: "en",
    timezone: "America/Chicago",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
    toc: true,
  },
  socials: [
    { name: "github",   url: "https://github.com/euporphium" },
    { name: "linkedin", url: "https://www.linkedin.com/in/kennethdnewton/" },
  ],
  shareLinks: [
    { name: "linkedin", url: "https://www.linkedin.com/sharing/share-offsite/?url=", linkTitle: "Share this post on LinkedIn" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});