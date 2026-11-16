---
title: "Thelo"
description: "A shared wishlist app for two, installable on a phone, with a guest demo. Built mostly by AI coding agents under my direction and self-hosted on my homelab."
date: 2026-11-08
tags: ["TanStack Start", "React 19", "TypeScript", "Tailwind CSS 4", "PostgreSQL", "Drizzle", "PWA"]
liveUrl: "https://thelo.i258.net/"
featured: true
---

## Overview

Thelo is the wishlist app my partner and I use. The name is Greek for "I want". Each of us keeps a list, ranks it, and can see the other's, so the list is on both phones and is there whenever one of us wants to buy the other a gift.

It is the third tool we have used for this, and the first one built for the purpose. I wrote about why it exists and how it was built in [Building Thelo: a shared wishlist, for the third time](/blog/building-thelo-shared-wishlist/).

## Try it

There is no sign-up page; I create accounts by hand. To look around, use "Try the demo" on the [sign-in page](https://thelo.i258.net/login). It creates a temporary guest account with fictional lists. Photo uploads, sharing and title lookup are off for guests, and the demo ends after 24 hours and is then deleted.

## What it does

- **Wishes:** text, links, photos and an optional amount, added from a full-screen sheet designed for a phone keyboard.
- **Ranking:** drag by a handle to reorder, with a menu alternative for keyboard and screen-reader users.
- **Received and archived:** tick a wish off, with Undo, or archive it.
- **Search** across wish text and links.
- **Sharing:** lists are private by default. Access is by invitation, as an editor or a viewer, and a list can also be published as a read-only page for anyone with the link.
- **Installable:** it runs as a Progressive Web App from the home screen, with light, dark and system themes.

## How it was built

Most of the code was written by AI coding agents that I directed. The first version was planned as 15 slices, each implemented by one agent and reviewed by another before it merged, and it went from first commit to a production release in a weekend. I set the direction, made the product decisions and approved each release to production.

## Stack

- **TanStack Start** with React 19 and TypeScript
- **Tailwind CSS 4**
- **PostgreSQL** with Drizzle
- **better-auth** for sessions
- **Vitest** and **Playwright** (Chromium and WebKit) for tests
- Self-hosted on my homelab

The source is private.
