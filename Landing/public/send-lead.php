<?php
/*
 * PHP 5-compatible endpoint for the landing form.
 * It accepts a same-origin JSON POST request and sends a notification through
 * Timeweb SMTP. The accompanying smtp-config.php stays on the server side.
 */

header('Content-Type: application/json; charset=utf-8');

function respond($status, $data) {
    if (function_exists('http_response_code')) {
        http_response_code($status);
    } else {
        header('X-PHP-Response-Code: ' . $status, true, $status);
    }
    echo json_encode($data);
    exit;
}

function clean_value($value, $max_length) {
    if (!is_string($value)) {
        return '';
    }
    $value = trim(str_replace(array("\r", "\n"), ' ', $value));
    return substr($value, 0, $max_length);
}

function smtp_read($socket) {
    $response = '';
    while (!feof($socket)) {
        $line = fgets($socket, 515);
        if ($line === false) {
            break;
        }
        $response .= $line;
        if (preg_match('/^\\d{3} /', $line)) {
            break;
        }
    }
    return $response;
}

function smtp_expect($socket, $allowed_codes) {
    $response = smtp_read($socket);
    $code = intval(substr($response, 0, 3));
    if (!in_array($code, $allowed_codes, true)) {
        throw new Exception('SMTP error ' . $code);
    }
}

function smtp_command($socket, $command, $allowed_codes) {
    fwrite($socket, $command . "\r\n");
    smtp_expect($socket, $allowed_codes);
}

function smtp_header($value) {
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function send_smtp_message($config, $subject, $body) {
    $socket = stream_socket_client(
        'ssl://' . $config['host'] . ':' . $config['port'],
        $errno,
        $errstr,
        20
    );
    if (!$socket) {
        throw new Exception('SMTP connection failed');
    }
    stream_set_timeout($socket, 20);
    try {
        smtp_expect($socket, array(220));
        smtp_command($socket, 'EHLO vitrina.local', array(250));
        smtp_command($socket, 'AUTH LOGIN', array(334));
        smtp_command($socket, base64_encode($config['username']), array(334));
        smtp_command($socket, base64_encode($config['password']), array(235));
        smtp_command($socket, 'MAIL FROM:<' . $config['from_email'] . '>', array(250));
        smtp_command($socket, 'RCPT TO:<' . $config['to_email'] . '>', array(250, 251));
        smtp_command($socket, 'DATA', array(354));

        $headers = array(
            'From: ' . smtp_header($config['from_name']) . ' <' . $config['from_email'] . '>',
            'To: <' . $config['to_email'] . '>',
            'Subject: ' . smtp_header($subject),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        );
        $message = implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($body), 76, "\r\n");
        $message = str_replace("\n.", "\n..", $message);
        fwrite($socket, $message . "\r\n.\r\n");
        smtp_expect($socket, array(250));
        smtp_command($socket, 'QUIT', array(221));
    } catch (Exception $exception) {
        fclose($socket);
        throw $exception;
    }
    fclose($socket);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, array('ok' => false, 'error' => 'Method not allowed'));
}

$content_type = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
if (stripos($content_type, 'application/json') !== 0) {
    respond(415, array('ok' => false, 'error' => 'Expected JSON'));
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 8192) {
    respond(400, array('ok' => false, 'error' => 'Invalid request'));
}
$lead = json_decode($raw, true);
if (!is_array($lead)) {
    respond(400, array('ok' => false, 'error' => 'Invalid JSON'));
}

$email = clean_value(isset($lead['email']) ? $lead['email'] : '', 254);
$intent = clean_value(isset($lead['intent']) ? $lead['intent'] : '', 20);
$source = clean_value(isset($lead['source']) ? $lead['source'] : '', 80);
$name = clean_value(isset($lead['name']) ? $lead['name'] : '', 120);
$museum = clean_value(isset($lead['museum']) ? $lead['museum'] : '', 180);
$plan = clean_value(isset($lead['plan']) ? $lead['plan'] : '', 40);
$billing_period = clean_value(isset($lead['billingPeriod']) ? $lead['billingPeriod'] : '', 10);

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !in_array($intent, array('waitlist', 'demo'), true) || $source === '') {
    respond(422, array('ok' => false, 'error' => 'Invalid form data'));
}
if ($billing_period !== '' && !in_array($billing_period, array('year', 'month'), true)) {
    respond(422, array('ok' => false, 'error' => 'Invalid billing period'));
}

$config = include dirname(dirname(__FILE__)) . '/private/smtp-config.php';
if (!is_array($config)) {
    respond(500, array('ok' => false, 'error' => 'Mail service is not configured'));
}

$lines = array(
    'Новая заявка на тест',
    '',
    'Email: ' . $email,
    'Тип заявки: ' . ($intent === 'demo' ? 'Запись на демо' : 'Лист ожидания'),
    'Источник: ' . $source,
);
if ($name !== '') $lines[] = 'Имя: ' . $name;
if ($museum !== '') $lines[] = 'Музей: ' . $museum;
if ($plan !== '') $lines[] = 'Тариф: ' . $plan;
if ($billing_period !== '') $lines[] = 'Период оплаты: ' . ($billing_period === 'year' ? 'Год' : 'Месяц');
if (isset($_SERVER['REMOTE_ADDR'])) $lines[] = 'IP: ' . clean_value($_SERVER['REMOTE_ADDR'], 64);

try {
    send_smtp_message($config, 'Новая заявка на тест', implode("\n", $lines));
    respond(201, array('ok' => true));
} catch (Exception $exception) {
    error_log('Vitrina lead mail error: ' . $exception->getMessage());
    respond(502, array('ok' => false, 'error' => 'Mail delivery failed'));
}
