---
title: "Building Thelo: a shared wishlist, for the third time"
description: "Why I built a wishlist app for two people, how AI coding agents built most of it in a weekend, and which decisions were still mine to make."
pubDatetime: 2026-11-16T01:00:00-06:00
tags: [ai-agents, pwa, homelab]
---

[Thelo](/projects/thelo/) is a wishlist app that my partner and I share. The name is Greek for "I want" ([θέλω](https://en.wiktionary.org/wiki/%CE%B8%CE%AD%CE%BB%CF%89)). It runs on my homelab, it was built for two people, and it is the third tool we have used for the same job.

I built the first version in about a day and a half, and most of the code was written by AI coding agents that I directed. The first pull request opened on a Saturday morning. The release that carried the redesign was merged for production about 25 hours later, 24 pull requests in.

The last project I wrote about here was [an exercise in implementing someone else's design](/blog/implementing-figma-community-design-nextjs/). This one is different: it is an app we use, and one I keep maintaining. This post covers why it exists, how that weekend worked, and two decisions that show where the agents helped and where I had to step in.

## Why a wishlist

My partner sees things she likes and tells me about them. It is casual conversation and it has never bothered me, but I wanted somewhere for those moments to go. Now when she shows me something, I can look at it, agree that it is really nice, and say "add it to your list."

The list is useful beyond that. She can re-rank it whenever she wants, so a couple dozen items stay sorted by what she wants most right now, and that order changes over time. And it is always there when I want to get her a gift, whether that is a birthday, a holiday or Christmas.

## The third time

The first version of this was a rudimentary sharing add-on to another app I was already self-hosting. What she liked was simple: her list was on her phone and on mine.

Then the old laptop where I was hosting that app crashed. I did not have the home server setup I have now, so we moved to [Craft](https://www.craft.do/), a notes app with checklists. That worked, but I wanted to get back to something I had written myself and that was built for this one purpose.

That meant asking her to move a third time, and it became my most important consideration while building. It had to be something I could sell her on as worth having. In practice that meant three things:

- The workflows had to be smooth on her phone, and tested.
- Her existing list had to be there already. The agents wrote an importer for the Craft export, photos included.
- She had to be signed in already, so the first thing she saw was her list and not a setup step.

## How the weekend worked

I did not hand-tune each interaction. I set the direction, and the work was planned as 15 slices: sign-in, wishes, the partner's read-only view, the installable phone app, ordering, links, photos, search, the import and a hardening pass. An agent implemented each slice, and each one got an independent review before it merged.

Three parts of that process are worth describing.

**Usability research.** Overnight on Saturday, agents built a knowledge base of UX guidance from published sources: 15 principles and 61 patterns, each linked to the evidence behind it and written so that an agent can retrieve one relevant piece at a time. It was researched and written by agents, checked by a different model, and has not been reviewed by a person or calibrated against real users. Its own documentation says so. Sunday's redesign drew on it, and I now ask that UI decisions in the app cite it.

**Review by several agents.** The idea of having a group of agents review the work and iterate until they agree came from [Theo's council skill](https://github.com/t3dotgg/tstack/tree/main/skills/council). I did not use his skill. I had an orchestrating agent send reviewers out, collect what they had trouble with and what they suggested, and iterate until they all agreed the quality was high.

**Testing on the right screen.** [T3 Code](https://t3.codes/), the tool I ran the agents in, can [hand an agent an iOS Simulator](https://github.com/pingdotgg/t3code/blob/main/docs/user/devices.md). I used one on my Mac set to her phone model. It was a simulator, not her phone, and the runs were patchy: several were blocked by the tooling. One that did run found that the amount field ended up hidden behind the keyboard when you tapped into it. That was fixed before the release, with an automated browser test that fails on the old code. The retest on the simulator was blocked too, so the fix went out on the strength of that test.

## Two decisions

When you add a wish there is a button labelled "Paste link". Tap it and the app reads your clipboard and attaches the link. If it cannot read the clipboard, or there is no link on it, it adds an empty row where you can paste or type the link instead. It is nothing novel, and I have seen it in other apps. It is also a feature I would not have thought to include, and it works as easily on a phone as anywhere else. The agents added it.

The second decision went the other way. A week later, while designing how lists would be shared with other people, the agents proposed an extra safeguard in the database for the case where an older version of the app is deployed by mistake. I turned it down in favour of a simpler rule about which versions are allowed to be deployed. The app is very early and had two users, and I felt that was the pragmatic choice.

## How it landed

I wanted everything ready before she ever saw it. I planted her password in our shared password manager so it was ready to go. Then I snuck onto her phone and logged into the app, so it was all set up.

After that I had to convince her to open it. Once she did, she liked it, and right away she preferred it to both of the tools she had used before. Her list was there and she was already signed in.

## Try it

Thelo has no sign-up page. I create accounts by hand, and I do not expect it to have many users. But I wanted it to be something you can try, so the following weekend I added a demo, along with sharing a list by invite and read-only public links.

On the [sign-in page](https://thelo.i258.net/login), "Try the demo" creates a temporary guest account with fictional lists: your own, a fictional partner's, and one you share. Photo uploads, sharing and title lookup are switched off for guests. The demo ends after 24 hours and its data is then deleted.

Opening an app built for two people to strangers was its own piece of work, and I plan to write about it separately.
