---
title: "Building Thelo: a shared wishlist, for the third time"
description: "Why I built a wishlist app for two people, how AI coding agents built most of it in a weekend, and which decisions were still mine to make."
pubDatetime: 2026-11-16T01:00:00-06:00
tags: [ai-agents, pwa, homelab]
---

[Thelo](/projects/thelo/) is a wishlist app that my partner and I share. The name is Greek for "I want" ([θέλω](https://en.wiktionary.org/wiki/%CE%B8%CE%AD%CE%BB%CF%89)). It runs on my homelab, it was built for two people, and it is the third tool we have used for the same job.

Each of us has a ranked list, and wishes are added from a sheet on the phone: text, a link, photos, or any mix. A demo is linked at the end of this post.

I built the first version in about a day, and most of the code was written by AI coding agents that I directed. The first pull request opened on a Saturday morning, and the release that carried the redesign was merged for production on Sunday, 24 pull requests in.

The last project I wrote about here was [an exercise in implementing someone else's design](/blog/implementing-figma-community-design-nextjs/). This one is an app we use and I keep maintaining. The post covers why it exists, how that weekend worked, what the agents planned that I would not have thought to specify, and where I overruled them.

## Why a wishlist

My partner sees things she likes and tells me about them. Over time I could not keep up with it all, especially as her preferences change: something comes up, and by the time I am ready or able to get it, she has a new number one. I wanted a way to manage those ideas and a list we could share. Now when she shows me something, I can look at it, agree that it is really nice, and say "add it to your list."

She can re-rank the list whenever she wants, so a couple dozen items stay sorted by what she wants most right now. And it is always there when I want to get her a gift.

## The third time

The first tool was a list I added to a chore and task app I had built and was hosting myself. The sharing was rudimentary, but what she liked was simple: her list was on her phone and on mine.

Then the old laptop where I was hosting that app crashed. I did not have the home server setup I have now, so we moved to [Craft](https://www.craft.do/), a notes app with checklists. It is someone else's product, and it worked. But I wanted to get back to something I had written myself, and this time something built for this one purpose.

That meant asking her to move a third time, and it became my most important consideration while building. It had to be something I could sell her on as worth having. In practice that meant smooth, tested workflows on her phone, her existing list already in place (the agents wrote an importer for the Craft export, photos included), and no setup step for her.

## How the weekend worked

I set the direction and approved a plan the agents wrote. It had 15 slices, among them sign-in, wishes, links, photos, search and the import, and it reused configuration and sign-in code from that earlier app of mine.

I intentionally kept myself out of most of the code. What I read myself was the planned database schema and the Docker and GitHub workflow files. I also confirmed the Node versions, making sure the app would not be affected by [Node2Shell](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

An agent implemented each slice, and a separate reviewer, GPT-6.1 Sol, reviewed it before it merged. On the links slice, for example, the reviewer found that a link pasted from the clipboard could arrive after you had tapped Save and change the wish being saved. The fix makes Save wait for a pending paste first.

Beyond that I relied on functional and integration tests led by the agents. What I accept as a green light is my own check: I do light manual testing before each release, and releases to production wait on my approval.

## What the agents added

Two details in the app are ones I would not have thought to specify. The agents put them in that plan.

One is a button labelled "Paste link" on the sheet where you add a wish. Tap it and the app reads your clipboard and attaches the link.

The other is that an unsaved wish is kept in the browser until you save or discard it. Leave the page halfway through and come back, and it is still there under a note reading "Restored your unsaved wish."

Seeing "Paste link" in the first build was part of what prompted me to commission the usability research described below that same night. I wanted more details of that kind.

## Research, review and testing

**Usability research.** Overnight on Saturday, agents built [a knowledge base of UX guidance](https://github.com/i258-net/web-app-ux) from published sources, which a different model checked and no person has reviewed. Sunday's redesign was measured against its touch-target guidance: no visible control under 44 pixels.

**Review by several agents.** The idea of having a group of agents review the work came from [Theo's council skill](https://github.com/t3dotgg/tstack/tree/main/skills/council), though I did not use the skill itself. An orchestrating agent sent reviewers out, collected their findings and iterated. That is agents agreeing with agents, and I do not accept an agent's approval, or a set of them, as a green light. In certain cases, having them swarm like this shaves away rough edges I would otherwise have to iterate on manually with an agent.

**Testing on the right screen.** [T3 Code](https://t3.codes/), the tool I ran the agents in, can [hand an agent an iOS Simulator](https://github.com/pingdotgg/t3code/blob/main/docs/user/devices.md). I used one set to her phone model, and several runs were blocked by the tooling. One that did run found that the optional amount field on a wish ended up hidden behind the keyboard when you tapped into it. The fix shipped with an automated browser test that fails on the old code, because the simulator retest was blocked too.

## How it landed

I wanted the move to take as little effort from her as possible. So I saved her password in our shared password manager and logged into the app on her phone before telling her about it. As soon as it was on there I told her, more or less: "Thelo is on your phone ready to go. I already logged in for you too, so you can just jump right in."

Part of her hesitation about moving again was reliability, since the first app crashing is what forced the move to Craft. When she first opened Thelo she really liked the look, and she appreciated that her full list was already there. Opening Thelo is also a more direct way to manage the list than opening Craft and finding the right document. She prefers the interface to both earlier tools and finds it the easiest to use.

She has 32 items on her list, and about half of them she added after the new app was available. She had not been maintaining it actively in Craft, and I think that extra step is likely why.

## Where I overruled them

The following weekend's work was bigger and I planned it differently: three larger pieces (shared lists, a guest demo and read-only public links), each broken into stories, with three releases to production that each waited on my approval. Both times I overruled the agents came during that work.

What I was learning in all of this was orchestration, and how to let agents work more on their own. Agents tend to aim for complete coverage, and deciding when that is not worth it stayed with me.

While designing how lists would be shared with other people, the agents proposed a check in the database that would stop an out-of-date version of the app from running if one were deployed by mistake. I chose to rely on a rule I follow when deploying instead. At this scale, that felt like the pragmatic choice.

The other case was session replay, which records what happens on screen so that a visit can be watched back. While adding analytics to Thelo, we used this site's setup as a reference. The agent recommended against replay on this site, which made sense, and it is off here. It then carried the same recommendation over to Thelo, and there I disagreed. I want replay available so I can dogfood this kind of tool and see whether it shows me anything about how the app is used.

Replay is on for signed-in members only, which today means my partner and me. She agreed without much concern, trusting me. She knows I can see what she clicks and does in the app, and that I can see and edit pretty much everything in her account, all the time, because I run it.

Guests in the demo and visitors who are not signed in are never recorded, though the demo does send ordinary usage analytics such as page views and clicks.

## What I learned

The first build and the later sharing and demo work were some of the longest-running orchestrations I have tried to manage. Compute became the bottleneck before inference did: the included GitHub Actions minutes ran out, because repeated runs of the end-to-end tests on pull requests depleted that bank quickly. So the lesson may not be about AI at all. When I scale up personal work I need a plan for that, and I will likely set up a build agent in my homelab to avoid those costs.

I also want better hygiene with git and worktrees locally as agents move around, and more work running in parallel. A full day of intermittent prompting can be hard to keep up with.

## Try it

Thelo has no sign-up page, and I create accounts by hand. But I wanted it to be something you can try.

The demo creates a temporary guest account with fictional lists: your own, a fictional partner's, and one you share. Photo uploads, sharing and title lookup are switched off for guests. It ends after 24 hours and its data is then deleted.

To look around, choose "Try the demo" on the [sign-in page](https://thelo.i258.net/login).
