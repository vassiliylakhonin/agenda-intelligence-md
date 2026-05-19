# v1 compatibility policy

After v1.0, Agenda Intelligence MD treats schema validity, CLI behavior, MCP tool names and signatures, packaged runtime asset paths, and score comparability as compatibility surfaces. Removing enum values, renaming required fields, changing MCP signatures, changing score semantics, or moving runtime assets without a compatibility shim requires a major version or an explicit deprecation path; adding optional fields, new enum values, or new tools can ship in minor versions when existing users remain valid.
