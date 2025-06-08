---
title: 'Creating an Ubuntu 25.04 Cloud Template in Proxmox'
description: 'A comprehensive guide to creating an Ubuntu 25.04 cloud-init template in Proxmox VE for streamlined VM deployment and infrastructure automation.'
pubDate: 'Jun 8, 2025'
---

Setting up cloud-init templates in Proxmox can significantly streamline your VM deployment process. Here's a step-by-step guide to create an Ubuntu 25.04 cloud template that you can clone and customize quickly.

## Prerequisites

- Proxmox VE environment
- Access to the Proxmox command line interface
- Basic familiarity with Proxmox VM management

## Step-by-Step Setup

### 1. Download the Ubuntu Cloud Image

First, download the Ubuntu 25.04 cloud image from the official repository:

```bash
# Navigate to the ISO directory
cd /var/lib/vz/template/iso/

# Download the Ubuntu 25.04 cloud image
wget https://cloud-images.ubuntu.com/plucky/current/plucky-server-cloudimg-amd64.img
```

> **Note**: The cloud image will be stored in `/var/lib/vz/template/iso/` when downloaded directly on your Proxmox host.

### 2. Create the Base VM

Create a new VM with the following specifications:

```bash
qm create 9001 --memory 4096 --cores 4 --name ubuntu-25.04 --net0 virtio,bridge=vmbr0
```

This command creates:
- VM ID: 9001
- Memory: 4GB RAM
- CPU: 4 cores
- Network: VirtIO adapter on default bridge

### 3. Import and Configure the Disk

Import the downloaded cloud image as a disk:

```bash
qm importdisk 9001 plucky-server-cloudimg-amd64.img local
```

Configure the imported disk:

```bash
qm set 9001 --scsihw virtio-scsi-pci --scsi0 local:9001/vm-9001-disk-0.raw
```

### 4. Set Up Cloud-Init

Create the Cloud-Init drive:

```bash
qm set 9001 --ide2 local:cloudinit
```

### 5. Configure Boot Settings

Make the SCSI disk bootable:

```bash
qm set 9001 --boot c --bootdisk scsi0
```

### 6. Add Serial Console Support

Enable serial console for better troubleshooting:

```bash
qm set 9001 --serial0 socket --vga serial0
```

### 7. Create the Template

**Important**: Do not boot the VM before creating the template!

1. In the Proxmox web interface, navigate to your VM (ID: 9001)
2. Right-click on the VM and select "Convert to template"
3. Confirm the conversion

## Using Your Template

Once created, you can:
- Clone the template to create new VMs
- Customize each clone with Cloud-Init settings (SSH keys, user accounts, network configuration)
- Deploy multiple instances quickly with consistent configurations

## Additional Configuration

After cloning from the template, configure Cloud-Init settings in the Proxmox UI:
- Set user credentials
- Add SSH public keys
- Configure network settings
- Set hostname and domain

## References

- [Perfect Proxmox Template with Cloud Image and Cloud Init](https://www.example.com)
- [Proxmox Cloud Init made easy with Ubuntu 24.04](https://www.example.com)

---

This template approach saves significant time when deploying multiple Ubuntu instances and ensures consistency across your infrastructure.