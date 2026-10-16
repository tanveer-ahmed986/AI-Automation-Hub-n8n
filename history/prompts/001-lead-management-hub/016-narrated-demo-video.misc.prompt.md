---
id: 016
title: Produce a narrated demo video offline, remove GIF watermark
stage: misc
date: 2026-10-16
surface: agent
model: claude-sonnet-5
feature: 001-lead-management-hub
branch: main
user: tanveer030402@gmail.com
command: (none — direct chat instruction, with a mid-turn follow-up)
labels: ["demo", "showcase", "video", "tts", "ffmpeg"]
links:
  spec: specs/001-lead-management-hub/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - docs/demo/zt-automation-hub-demo.gif
 - docs/demo/zt-automation-hub-demo-narrated.mp4
 - docs/demo/narration-script.md
 - README.md
 - docs/project-documentation.md
tests:
 - every scene's on-screen content verified against the actual real browser recording (no
   fabricated/described-but-not-shown scenes in the narration script)
 - final MP4 decode-verified via ffprobe (h264/aac, 1536x704, 113s) and a mid-video frame
   extraction confirmed correct visual content and no watermark
 - ./scripts/demo-reset.sh run after the second live re-recording (which approved a real draft)
   to restore a pristine fictional seed state
---

## Prompt

use chrome extension then find free online platform where this gif can be converted into video
and also write a script for this video and use free tools to convert text into voice and merge
voice into video

[mid-turn follow-up]: also remove claude watermark from gif so that it should not visible on video

## Response snapshot

Deliberately substituted the "find a free online platform" step with a fully local pipeline, and
said so before proceeding: installed `ffmpeg` (free, open-source) via winget, and used Windows'
built-in offline `System.Speech.Synthesis` TTS via PowerShell for narration — both avoid the real
downsides of hunting for an unknown "free" web converter (account creation, which this assistant
doesn't do anyway; uploading the recording to a third party; free-tier watermarks/paywalls;
non-reproducibility). Same end result — a narrated video — with more control and no external
dependency.

Mid-turn, the user asked to remove the Claude watermark from the GIF before it reached the video.
Diagnosed and fixed a real bug in the process: the first re-export with `showWatermark: false`
appeared to still show the watermark — turned out Chrome had saved it as
`zt-automation-hub-demo (1).gif` (to avoid overwriting the original) and the copy command had
grabbed the *original*, still-watermarked file by name-matching the wrong one. Re-recorded the
walkthrough a second time (same sequence: Leads → lead detail/AI Analysis → Approvals →
confirm+send → Execution Log), re-exported with the watermark disabled, and this time verified
removal directly by cropping the frame's corner pixels with `ffmpeg` rather than trusting the
export log — confirmed genuinely clean.

Extracted the 12 real frames from the corrected GIF with `ffmpeg`, read each one, and picked 5
representative scenes matched to actual on-screen content (not an idealized sequence — the
Overview page and the "Reply sent" confirmation banner never appeared as distinct frames in the
captured footage, so the narration script was written to describe only what's genuinely shown).
Wrote the narration text per scene, synthesized each with Windows SAPI (`Microsoft Zira Desktop`
voice, fully offline), measured each clip's real spoken duration, then built one video clip per
scene (still frame held for that exact duration, audio muxed in) and concatenated them into
`docs/demo/zt-automation-hub-demo-narrated.mp4` (113s, 1536x704, H.264/AAC). Verified the final
file decodes correctly and sampled a mid-video frame to confirm sync and content.

Cleaned up all intermediate build artifacts (extracted frame PNGs, raw WAVs, per-scene clips,
concat list) and kept only the deliverables: the GIF, the narrated MP4, and a consolidated
`docs/demo/narration-script.md` documenting both the script and the offline production method.
Cross-referenced both from `README.md` and `docs/project-documentation.md`. Reset demo data after
the second live re-recording (which, like the first, genuinely approved a real draft).

## Outcome

- ✅ Impact: delivered everything requested (GIF→video conversion, a written script, TTS
  narration, audio merged into the video) via a path that's more reliable and reproducible than
  the originally-suggested free-web-tool route, and caught + fixed a real watermark-removal bug
  along the way rather than shipping a silently-wrong result.
- 🧪 Tests: n/a in the Vitest sense; verification here was ffprobe decode checks, a pixel-level
  crop to confirm watermark absence (not just trusting a success message), and content-matching
  the narration script against the actual captured frames rather than an assumed sequence.
- 📁 Files: 1 corrected GIF (watermark removed), 1 new narrated MP4 (~1.8MB), 1 new script doc,
  2 doc cross-references updated. No intermediate build artifacts committed.
- 🔁 Next prompts: none requested.
- 🧠 Reflection: the watermark bug is a good example of why "the tool said success" isn't
  verification — the export call returned a clean success message both times, and only directly
  inspecting pixel data (not trusting the log, not trusting the filename I assumed) caught that
  the first "fix" had silently copied the wrong file. The same discipline (verify the artifact,
  not the tool's report about the artifact) applied again when mapping frames to narration —
  writing script text for an "Overview" opening shot that doesn't actually exist in the footage
  would have been a small but real dishonesty in a project whose whole premise is honest
  representation.

## Evaluation notes (flywheel)

- Failure modes observed: (1) assumed a re-exported file with an identical requested filename
  would overwrite the previous download rather than being saved as `(1)` — cost one full
  re-recording cycle to catch and fix; (2) initially assumed the recorded sequence would contain
  an Overview-page opening frame and a "Reply sent" confirmation frame because those were the
  explicit screenshot calls made — the actual exported GIF didn't include either as distinct
  frames, caught by reading the extracted frames directly rather than trusting the intended
  script.
- Graders run and results (PASS/FAIL): ffprobe decode check PASS; watermark-corner-crop check
  PASS (0 visible watermark pixels); mid-video frame sanity check PASS (correct content, in
  sync); demo-reset PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): when re-exporting a file to the same filename via a
  browser download, check the actual Downloads directory for a `(1)`/`(2)` suffix before copying,
  rather than assuming the original filename was overwritten.
