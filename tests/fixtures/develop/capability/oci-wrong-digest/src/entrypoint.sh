#!/usr/bin/env sh
# A clean fetched tree for the OCI fixture. Deliberately boring: the content scan must find
# nothing here, so that a BLOCK on this fixture can only come from the metadata half.
set -eu
echo "oci-tool starting"
exec "$@"
