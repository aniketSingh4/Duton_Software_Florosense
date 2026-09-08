import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateInput) {
  if (!dateInput) return "--"
  try {
    const date = new Date(dateInput)
    if (isNaN(date.getTime())) return "--"
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${day}/${month}/${year}`
  } catch {
    return "--"
  }
}

export function formatDateTime(dateInput) {
  if (!dateInput) return "--"
  try {
    const date = new Date(dateInput)
    if (isNaN(date.getTime())) return "--"
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
  } catch {
    return "--"
  }
}