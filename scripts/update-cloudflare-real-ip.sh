#!/bin/sh

set -eu

umask 022

ipv4_url=${CLOUDFLARE_IPV4_URL:-https://www.cloudflare.com/ips-v4}
ipv6_url=${CLOUDFLARE_IPV6_URL:-https://www.cloudflare.com/ips-v6}
target=${CLOUDFLARE_REAL_IP_TARGET:-/etc/plexoria/nginx/cloudflare-real-ip.conf}
container=${NGINX_CONTAINER:-digital-store-nginx}
curl_bin=${CURL_BIN:-curl}
docker_bin=${DOCKER_BIN:-docker}

case "$target" in
  /*/cloudflare-real-ip.conf) ;;
  *) echo "target must be an absolute cloudflare-real-ip.conf path" >&2; exit 1 ;;
esac
case "$container" in
  *[!A-Za-z0-9_.-]*|'') echo "invalid nginx container name" >&2; exit 1 ;;
esac

target_dir=$(dirname "$target")
install -d -m 0755 "$target_dir"
work_dir=$(mktemp -d "$target_dir/.cloudflare-real-ip.XXXXXX")
candidate="$work_dir/cloudflare-real-ip.conf"
backup="$work_dir/previous.conf"
test_config="$work_dir/nginx-test.conf"

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT HUP INT TERM

fetch_feed() {
  "$curl_bin" --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
    --connect-timeout 10 --max-time 30 --max-filesize 65536 "$1"
}

fetch_feed "$ipv4_url" > "$work_dir/ips-v4"
fetch_feed "$ipv6_url" > "$work_dir/ips-v6"

emit_feed() {
  family=$1
  input=$2
  minimum=$3
  sorted="$work_dir/${family}-sorted"
  LC_ALL=C sort -u "$input" > "$sorted"
  count=0
  while IFS= read -r cidr || [ -n "$cidr" ]; do
    case "$family:$cidr" in
      v4:*[!0-9./]*|v4:*:*|v4:|v6:*[!0-9A-Fa-f:/]*|v6:*.*|v6:)
        echo "invalid Cloudflare $family CIDR" >&2
        return 1
        ;;
    esac
    case "$cidr" in
      */*) ;;
      *) echo "Cloudflare $family entry is not a CIDR" >&2; return 1 ;;
    esac
    printf 'set_real_ip_from %s;\n' "$cidr"
    count=$((count + 1))
  done < "$sorted"
  if [ "$count" -lt "$minimum" ] || [ "$count" -gt 1000 ]; then
    echo "unexpected Cloudflare $family CIDR count: $count" >&2
    return 1
  fi
}

{
  printf '%s\n' '# Generated from Cloudflare official IPv4 and IPv6 proxy network feeds.'
  printf '%s\n' '# Direct origin clients are intentionally not trusted to supply this header.'
  emit_feed v4 "$work_dir/ips-v4" 10
  emit_feed v6 "$work_dir/ips-v6" 5
  printf '%s\n' 'real_ip_header CF-Connecting-IP;'
  printf '%s\n' 'real_ip_recursive on;'
} > "$candidate"
chmod 0644 "$candidate"

if [ -f "$target" ] && cmp -s "$candidate" "$target"; then
  echo "Cloudflare real-IP networks are already current"
  exit 0
fi

candidate_name=$(basename "$work_dir")/$(basename "$candidate")
cat > "$test_config" <<EOF
events {}
http { include /etc/nginx/runtime/$candidate_name; }
EOF
test_name=$(basename "$work_dir")/$(basename "$test_config")

"$docker_bin" exec "$container" nginx -t -c "/etc/nginx/runtime/$test_name"

if [ -f "$target" ]; then
  cp -p "$target" "$backup"
fi
mv "$candidate" "$target"

if ! "$docker_bin" exec "$container" nginx -t; then
  if [ -f "$backup" ]; then mv "$backup" "$target"; else rm -f "$target"; fi
  echo "full nginx validation failed; previous Cloudflare networks restored" >&2
  exit 1
fi

if ! "$docker_bin" exec "$container" nginx -s reload; then
  if [ -f "$backup" ]; then mv "$backup" "$target"; else rm -f "$target"; fi
  "$docker_bin" exec "$container" nginx -t >/dev/null 2>&1 || true
  "$docker_bin" exec "$container" nginx -s reload >/dev/null 2>&1 || true
  echo "nginx reload failed; previous Cloudflare networks restored" >&2
  exit 1
fi

echo "Cloudflare real-IP networks updated and nginx reloaded"
