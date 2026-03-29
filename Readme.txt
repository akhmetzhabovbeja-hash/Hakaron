# Hakaron — AI-платформа для отбора кандидатов

## Быстрый старт (Docker)

1. Скопируй `.env.example` в `.env`:
   cp .env.example .env

2. Запусти все сервисы в dev-режиме:
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

3. Открой в браузере:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000/docs
   - ML Service: http://localhost:8001/docs

## Структура проекта

  frontend/       — React + TypeScript + Vite + TailwindCSS
  backend/        — Python FastAPI + SQLAlchemy + PostgreSQL
  ml-service/     — Python FastAPI + PyTorch + Transformers
  docs/           — Архитектура и ТЗ для команд

## Документация

  docs/ARCHITECTURE.md   — Общая архитектура системы
  docs/FRONTEND_SPEC.md  — ТЗ для фронтенд-разработчиков
  docs/BACKEND_SPEC.md   — ТЗ для бекенд-разработчиков
  docs/ML_SPEC.md        — ТЗ для ML-разработчиков
  docs/API_SPEC.md       — Спецификация REST API

## Сервисы

  | Сервис        | Порт | Стек                          |
  |---------------|------|-------------------------------|
  | Frontend      | 3000 | React, TypeScript, Vite       |
  | Backend       | 8000 | FastAPI, SQLAlchemy, Celery   |
  | ML Service    | 8001 | FastAPI, PyTorch, Transformers|
  | PostgreSQL    | 5432 | PostgreSQL 16                 |
  | Redis         | 6379 | Redis 7                       |
  | Celery Worker | —    | Celery + Redis                |
