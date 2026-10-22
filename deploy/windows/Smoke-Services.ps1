param([switch]$KeepData)
$ErrorActionPreference='Stop'
Set-Location (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
$config=Get-Content .runtime/config.json -Raw | ConvertFrom-Json
$account=Get-Content .runtime/test-account.json -Raw | ConvertFrom-Json
$publication=Get-Content .runtime/smoke-publication.json -Raw | ConvertFrom-Json
$base='http://127.0.0.1'
function Call($method,$path,$token,$body=$null) {
 $params=@{Uri="$base$path";Method=$method;TimeoutSec=20}
 if($token){$params.Headers=@{Authorization="Bearer $token"}}
 if($null -ne $body){$params.ContentType='application/json';$params.Body=$body|ConvertTo-Json -Depth 12 -Compress}
 Invoke-RestMethod @params
}
$login=Call POST '/api/auth/api/v1/auth/login' '' @{email=$account.email;password=$account.password}
$token=$login.access_token
$pub=Call GET "/api/artifacts/api/v1/public/artifacts/$($publication.public_code)" ''
$marker='smoke-'+[guid]::NewGuid().ToString('N')
try {
$created=Call POST '/api/route/api/v1/routes' $token @{title=$marker;description='Integration check';artifact_ids=@($pub.artifact.id);status='published';visibility='public'}
$routeId=$created.route.id
$started=Call POST "/api/route/api/v1/public/routes/$routeId/start" '' @{visitor_key=$marker;session_id=$marker}
$again=Call POST "/api/route/api/v1/public/routes/$routeId/start" '' @{visitor_key=$marker;session_id=$marker}
if($started.visit.id -ne $again.visit.id){throw 'Route start is not idempotent'}
Call POST "/api/artifacts/api/v1/public/artifacts/$($publication.public_code)/collect" '' @{visitor_id=$marker} | Out-Null
$progress=Call POST "/api/route/api/v1/public/routes/$routeId/progress" '' @{visitor_key=$marker;session_id=$marker;artifact_id=$pub.artifact.id}
if(!$progress.visit.completed){throw 'Confirmed collection did not complete one-artifact route'}
Write-Output 'PASS route publication, idempotent start, confirmed collection and completion'
$password=[guid]::NewGuid().ToString('N')+'Aa!'
$email="$marker@example.invalid"
$visitor=Call POST '/api/auth/api/v1/auth/visitor/register' '' @{email=$email;password=$password;display_name='Integration visitor'}
$visitorLogin=Call POST '/api/auth/api/v1/auth/visitor/login' '' @{email=$email;password=$password}
$input=@{id=$marker;public_code=$publication.public_code;type='review';title=$marker;body='Integration feedback';rating=5}
$feedback=Call POST '/api/feedback/api/v1/public/feedback' $visitorLogin.access_token $input
$feedbackId=$feedback.feedback.id
$duplicate=Call POST '/api/feedback/api/v1/public/feedback' $visitorLogin.access_token $input
if(!$duplicate.duplicate){throw 'Feedback retry not deduplicated'}
Call PUT "/api/feedback/api/v1/feedback/$feedbackId/reply" $token @{body='Integration reply';status='published'} | Out-Null
Call PATCH "/api/feedback/api/v1/feedback/$feedbackId" $token @{status='published'} | Out-Null
$reviews=Call GET "/api/feedback/api/v1/public/museums/$($pub.artifact.museum_id)/reviews" ''
if(!($reviews.items|Where-Object id -eq $feedbackId)){throw 'Published review missing'}
Write-Output 'PASS visitor feedback, replay, museum reply and moderation'
foreach($path in @('/api/route/api/v1/routes/summary','/api/route/api/v1/routes/recent-activity','/api/notification/api/v1/notifications?page=1&limit=20','/api/feedback/api/v1/feedback?page=1&limit=20','/api/dashboard/api/v1/dashboard/feedback','/api/dashboard/api/v1/dashboard/popular-routes')){
 Call GET $path $token | Out-Null
 Write-Output "PASS 200 $path"
}
$notifications=Call GET '/api/notification/api/v1/notifications' $token
$item=$notifications.items|Where-Object {$_.title -like "*$marker*"}|Select-Object -First 1
if(!$item){throw 'Source event not delivered as a notification'}
Call POST "/api/notification/api/v1/notifications/$($item.id)/read" $token | Out-Null
$summary=Call GET '/api/dashboard/api/v1/dashboard/summary' $token
if($null -eq $summary.museum_rating){throw 'Dashboard rating not projected'}
if($null -eq $summary.avg_progress_percent){throw 'Dashboard route progress not projected'}
@{marker=$marker;routeId=$routeId;feedbackId=$feedbackId;userId=$visitor.user.id;routeUrl="$base/routes/$routeId";code=$publication.public_code} | ConvertTo-Json | Set-Content .runtime/services-smoke-state.json
Write-Output 'PASS PostgreSQL -> source event -> notification; dashboard rating and route progress'
} finally {
 if (!$KeepData) { & "$PSScriptRoot/Cleanup-SmokeServices.ps1" -Marker $marker }
}
