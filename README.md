# pi-uncached-warning

Shows a widget like `new task? /new to save 169.4k tokens (prompt cache expired)` once the
prompt cache of an idle session has expired, so the next message would re-bill the whole context.

- Cache lifetime comes from the model's `promptCache` (`short`, or `long` when `PI_CACHE_RETENTION=long`); falls back to 5 minutes.
- Cache warming refreshes (`cache_warm` usage entries) count as cache activity.
- Hidden below 10k tokens and while the agent is running.

Install: `pi install git:github.com/Sciencentistguy/pi-uncached-warning`
