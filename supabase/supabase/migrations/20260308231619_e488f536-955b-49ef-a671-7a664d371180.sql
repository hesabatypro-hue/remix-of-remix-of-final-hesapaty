
-- Schedule retry worker to run every 5 minutes
SELECT cron.schedule(
  'retry-failed-jobs',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/retry-failed-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
    ),
    body := jsonb_build_object('timestamp', now())
  ) AS request_id;
  $$
);
