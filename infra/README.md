# Infrastructure Boundary

Infrastructure owns migrations, object storage, queues, IAM and observability wiring. Module-owned data remains in module-owned schemas; cross-module writes use owner APIs or events, never direct SQL writes.
