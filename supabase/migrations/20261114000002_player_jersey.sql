-- Migration: Add jersey column to players table
-- Allows players to claim/display their jersey number (e.g. 0-99, 00)
alter table public.players
  add column if not exists jersey text;
