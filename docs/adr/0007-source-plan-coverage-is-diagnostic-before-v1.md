# Source plan coverage is diagnostic before v1

Source Plans define the source types that should be checked for a claim category, but missing `must_check` coverage does not make `validate-evidence` fail before v1.0. Treat missing required source types as diagnostic evidence gaps that should be disclosed, scored, or reviewed; a future strict source-plan gate may make them machine-enforceable without changing the meaning of schema validity.
