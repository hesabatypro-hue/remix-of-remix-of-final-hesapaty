CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: whatsapp_connection_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.whatsapp_connection_status AS ENUM (
    'connected',
    'pending',
    'disconnected'
);


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text,
    phone text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    whatsapp_connection_id uuid,
    amount numeric(15,2) NOT NULL,
    transfer_date date DEFAULT CURRENT_DATE NOT NULL,
    sender_name text,
    sender_phone text,
    image_url text,
    extracted_data jsonb,
    is_confirmed boolean DEFAULT false NOT NULL,
    confirmed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    phone_number text NOT NULL,
    whatsapp_business_id text,
    access_token text,
    webhook_verify_token text,
    status public.whatsapp_connection_status DEFAULT 'pending'::public.whatsapp_connection_status NOT NULL,
    last_sync_at timestamp with time zone,
    verification_code text,
    verification_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    connection_type text DEFAULT 'meta'::text NOT NULL,
    green_api_instance_id text,
    green_api_token text,
    meta_phone_number_id text,
    CONSTRAINT check_connection_type CHECK ((connection_type = ANY (ARRAY['meta'::text, 'green_api'::text, 'manual'::text])))
);


--
-- Name: whatsapp_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    whatsapp_connection_id uuid NOT NULL,
    message_id text NOT NULL,
    from_number text NOT NULL,
    message_type text NOT NULL,
    content text,
    media_url text,
    processed boolean DEFAULT false NOT NULL,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: transfers transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_connections whatsapp_connections_branch_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_branch_id_key UNIQUE (branch_id);


--
-- Name: whatsapp_connections whatsapp_connections_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_phone_number_key UNIQUE (phone_number);


--
-- Name: whatsapp_connections whatsapp_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_messages whatsapp_messages_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_message_id_key UNIQUE (message_id);


--
-- Name: whatsapp_messages whatsapp_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id);


--
-- Name: idx_whatsapp_connections_meta_phone_number_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_connections_meta_phone_number_id ON public.whatsapp_connections USING btree (meta_phone_number_id) WHERE (meta_phone_number_id IS NOT NULL);


--
-- Name: branches update_branches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transfers update_transfers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_transfers_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: whatsapp_connections update_whatsapp_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_whatsapp_connections_updated_at BEFORE UPDATE ON public.whatsapp_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: transfers transfers_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: transfers transfers_whatsapp_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_whatsapp_connection_id_fkey FOREIGN KEY (whatsapp_connection_id) REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;


--
-- Name: whatsapp_connections whatsapp_connections_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_connections
    ADD CONSTRAINT whatsapp_connections_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: whatsapp_messages whatsapp_messages_whatsapp_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_whatsapp_connection_id_fkey FOREIGN KEY (whatsapp_connection_id) REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE;


--
-- Name: branches Allow public delete to branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete to branches" ON public.branches FOR DELETE USING (true);


--
-- Name: transfers Allow public delete to transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete to transfers" ON public.transfers FOR DELETE USING (true);


--
-- Name: whatsapp_connections Allow public delete to whatsapp_connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete to whatsapp_connections" ON public.whatsapp_connections FOR DELETE USING (true);


--
-- Name: branches Allow public insert to branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert to branches" ON public.branches FOR INSERT WITH CHECK (true);


--
-- Name: transfers Allow public insert to transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert to transfers" ON public.transfers FOR INSERT WITH CHECK (true);


--
-- Name: whatsapp_connections Allow public insert to whatsapp_connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert to whatsapp_connections" ON public.whatsapp_connections FOR INSERT WITH CHECK (true);


--
-- Name: whatsapp_messages Allow public insert to whatsapp_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert to whatsapp_messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (true);


--
-- Name: branches Allow public read access to branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to branches" ON public.branches FOR SELECT USING (true);


--
-- Name: transfers Allow public read access to transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to transfers" ON public.transfers FOR SELECT USING (true);


--
-- Name: whatsapp_connections Allow public read access to whatsapp_connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to whatsapp_connections" ON public.whatsapp_connections FOR SELECT USING (true);


--
-- Name: whatsapp_messages Allow public read access to whatsapp_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to whatsapp_messages" ON public.whatsapp_messages FOR SELECT USING (true);


--
-- Name: branches Allow public update to branches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update to branches" ON public.branches FOR UPDATE USING (true);


--
-- Name: transfers Allow public update to transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update to transfers" ON public.transfers FOR UPDATE USING (true);


--
-- Name: whatsapp_connections Allow public update to whatsapp_connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update to whatsapp_connections" ON public.whatsapp_connections FOR UPDATE USING (true);


--
-- Name: whatsapp_messages Allow public update to whatsapp_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update to whatsapp_messages" ON public.whatsapp_messages FOR UPDATE USING (true);


--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;