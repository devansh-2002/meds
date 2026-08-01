-- DawaiSaathi PostgreSQL Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Patients Table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Medications Table
CREATE TABLE IF NOT EXISTS public.medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT,
    inventory INTEGER DEFAULT 0,
    instructions TEXT,
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Schedules Table
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID REFERENCES public.medications(id) ON DELETE CASCADE,
    scheduled_time TIME NOT NULL, -- Format 'HH:MM:SS'
    active_days TEXT[] DEFAULT '{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Doses Log Table
CREATE TABLE IF NOT EXISTS public.doses_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medication_id UUID REFERENCES public.medications(id) ON DELETE CASCADE,
    scheduled_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    logged_datetime TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('taken', 'missed', 'snoozed', 'pending')),
    alert_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create Indexes for fast querying
CREATE INDEX idx_patients_phone ON public.patients(phone);
CREATE INDEX idx_medications_patient ON public.medications(patient_id);
CREATE INDEX idx_schedules_medication ON public.schedules(medication_id);
CREATE INDEX idx_doses_log_medication ON public.doses_log(medication_id);
CREATE INDEX idx_doses_log_status ON public.doses_log(status);
