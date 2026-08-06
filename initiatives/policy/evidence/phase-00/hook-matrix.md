# Hook-interception feasibility matrix

Generated from `.mcp.json` by `policy-matrix.mjs`. Do not hand-edit -- a server with no
row is an exit-2 build failure, which is what keeps this honest.

| surface | server | tool | capability | verdict |
|---|---|---|---|---|
| builtin | - | `Bash` | shell | intercepted |
| builtin | - | `PowerShell` | shell | intercepted |
| builtin | - | `Write` | write | intercepted |
| builtin | - | `Edit` | write | intercepted |
| builtin | - | `NotebookEdit` | write | intercepted |
| builtin | - | `Read` | read | intercepted |
| builtin | - | `Glob` | read | intercepted |
| builtin | - | `Grep` | read | intercepted |
| builtin | - | `WebFetch` | network | intercepted |
| builtin | - | `WebSearch` | network | intercepted |
| builtin | - | `Agent` | shell | intercepted |
| builtin | - | `Task` | shell | intercepted |
| builtin | - | `*` | shell, write, network | intercepted |
| mcp | supabase | `mcp__supabase__apply_migration` | write, deploy | static-deny |
| mcp | supabase | `mcp__supabase__execute_sql` | write | intercepted |
| mcp | supabase | `mcp__supabase__deploy_edge_function` | deploy | static-deny |
| mcp | supabase | `mcp__supabase__create_branch` | deploy | static-deny |
| mcp | supabase | `mcp__supabase__delete_branch` | deploy | static-deny |
| mcp | supabase | `mcp__supabase__merge_branch` | deploy | static-deny |
| mcp | supabase | `mcp__supabase__rebase_branch` | deploy | static-deny |
| mcp | supabase | `mcp__supabase__reset_branch` | deploy | static-deny |
| mcp | supabase | `mcp__supabase__list_tables` | read | intercepted |
| mcp | supabase | `mcp__supabase__list_migrations` | read | intercepted |
| mcp | supabase | `mcp__supabase__list_branches` | read | intercepted |
| mcp | supabase | `mcp__supabase__list_extensions` | read | intercepted |
| mcp | supabase | `mcp__supabase__list_edge_functions` | read | intercepted |
| mcp | supabase | `mcp__supabase__get_edge_function` | read | intercepted |
| mcp | supabase | `mcp__supabase__get_logs` | read | intercepted |
| mcp | supabase | `mcp__supabase__get_advisors` | read | intercepted |
| mcp | supabase | `mcp__supabase__get_project_url` | read | intercepted |
| mcp | supabase | `mcp__supabase__get_publishable_keys` | read | intercepted |
| mcp | supabase | `mcp__supabase__generate_typescript_types` | read | intercepted |
| mcp | supabase | `mcp__supabase__search_docs` | network | intercepted |
| mcp | supabase | `mcp__supabase__*` | write, deploy | static-deny |
| mcp | playwright | `mcp__playwright__browser_navigate` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_navigate_back` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_network_request` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_network_requests` | read | intercepted |
| mcp | playwright | `mcp__playwright__browser_evaluate` | shell, network | intercepted |
| mcp | playwright | `mcp__playwright__browser_run_code_unsafe` | shell, network | intercepted |
| mcp | playwright | `mcp__playwright__browser_file_upload` | read, network | intercepted |
| mcp | playwright | `mcp__playwright__browser_take_screenshot` | write | intercepted |
| mcp | playwright | `mcp__playwright__browser_snapshot` | read | intercepted |
| mcp | playwright | `mcp__playwright__browser_console_messages` | read | intercepted |
| mcp | playwright | `mcp__playwright__browser_find` | read | intercepted |
| mcp | playwright | `mcp__playwright__browser_click` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_type` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_fill_form` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_press_key` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_hover` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_select_option` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_drag` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_drop` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_resize` | read | intercepted |
| mcp | playwright | `mcp__playwright__browser_tabs` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_wait_for` | read | intercepted |
| mcp | playwright | `mcp__playwright__browser_handle_dialog` | network | intercepted |
| mcp | playwright | `mcp__playwright__browser_close` | read | intercepted |
| mcp | playwright | `mcp__playwright__*` | network, shell | intercepted |
| mcp | context7 | `mcp__context7__query-docs` | network | intercepted |
| mcp | context7 | `mcp__context7__resolve-library-id` | network | intercepted |
| mcp | context7 | `mcp__context7__*` | network | intercepted |
| mcp | stripe | `mcp__stripe__*` | spend | static-deny |
