#!/bin/bash

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

# Configuration
SWAP_FILE="/swapfile"
SWAP_SIZE="4096"  # 4GB in MB

echo "Starting swap file setup..."

# Check if swap file already exists
if [ -f "$SWAP_FILE" ]; then
    echo "Swap file already exists. Removing old swap file..."
    swapoff "$SWAP_FILE" || echo "Failed to deactivate old swap"
    rm "$SWAP_FILE" || echo "Failed to remove old swap file"
fi

# Create swap file
echo "Creating ${SWAP_SIZE}MB swap file..."
dd if=/dev/zero of="$SWAP_FILE" bs=1M count="$SWAP_SIZE" status=progress || {
    echo "Failed to create swap file"
    exit 1
}

# Set correct permissions
echo "Setting swap file permissions..."
chmod 600 "$SWAP_FILE" || {
    echo "Failed to set permissions"
    exit 1
}

# Set up swap space
echo "Setting up swap space..."
mkswap "$SWAP_FILE" || {
    echo "Failed to set up swap space"
    exit 1
}

# Enable swap
echo "Enabling swap..."
swapon "$SWAP_FILE" || {
    echo "Failed to enable swap"
    exit 1
}

# Verify swap is enabled
echo "Verifying swap configuration..."
swapon -s

# Add to fstab for persistence across reboots
if ! grep -q "$SWAP_FILE" /etc/fstab; then
    echo "Adding swap to /etc/fstab..."
    echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
fi

echo "Swap setup completed successfully!"