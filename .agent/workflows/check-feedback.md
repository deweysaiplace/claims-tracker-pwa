---
description: Automated Feedback Pulse (v1.7.8 SOP)
---
// turbo-all

1. Fetch the latest user feedback from Supabase.
   CommandLine: `$headers = @{ "apikey" = "sb_publishable_b8AXhrbQDkVdfzz_p1ZiQw_koRnf7kG"; "Authorization" = "Bearer sb_publishable_b8AXhrbQDkVdfzz_p1ZiQw_koRnf7kG" }; $url = "https://hmccsbyhubmgrxfamhfw.supabase.co/rest/v1/error_logs?message=ilike.USER_FEEDBACK%3A*&order=created_at.desc&limit=5"; Invoke-RestMethod -Uri $url -Headers $headers -Method Get | ConvertTo-Json`

2. If any new bugs/issues are found since the last session, prioritize resolving them immediately.
3. Note the resolution in the walkthrough or next message to the user.
