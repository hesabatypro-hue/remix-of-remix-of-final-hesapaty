
-- Make receipts bucket private
UPDATE storage.buckets SET public = false WHERE id = 'receipts';
