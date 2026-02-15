$body = @{
    url = "https://tg-group-admin.vercel.app/api/telegram/webhook"
    allowed_updates = @(
        "message",
        "edited_message",
        "channel_post",
        "edited_channel_post",
        "inline_query",
        "chosen_inline_result",
        "callback_query",
        "shipping_query",
        "pre_checkout_query",
        "poll",
        "poll_answer",
        "my_chat_member",
        "chat_member",
        "chat_join_request"
    )
    drop_pending_updates = $true
} | ConvertTo-Json -Depth 3

$token = "8215343577:AAGNkazlxhM2eEVzc2DkDWKnP9kioQ90LyE"
$uri = "https://api.telegram.org/bot$token/setWebhook"

Write-Host "Setting webhook..."
Write-Host "Body: $body"

$response = Invoke-RestMethod -Uri $uri -Method POST -ContentType "application/json" -Body $body
Write-Host "Response: $($response | ConvertTo-Json)"

# Verify
$verifyResponse = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getWebhookInfo"
Write-Host "Webhook Info: $($verifyResponse.result | ConvertTo-Json)"
