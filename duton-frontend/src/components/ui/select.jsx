"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const SelectContext = React.createContext({
  value: "",
  onValueChange: () => {},
  open: false,
  onOpenChange: () => {},
})

const Select = ({ value, onValueChange, children, ...props }) => {
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState("")
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  const handleValueChange = React.useCallback((newValue) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
    setOpen(false)
  }, [isControlled, onValueChange])

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleValueChange, open, onOpenChange: setOpen }}>
      <div className="relative" {...props}>
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => context.onOpenChange(!context.open)}
      {...props}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("transition-transform", context.open && "rotate-180")}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder, ...props }) => {
  const context = React.useContext(SelectContext)
  const displayValue = context.value || placeholder || "Select..."
  
  return <span {...props}>{displayValue}</span>
}

const SelectContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  
  if (!context.open) return null

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef(({ className, value, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  const isSelected = context.value === value

  return (
    <div
      ref={ref}
      role="option"
      aria-selected={isSelected}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground",
        className
      )}
      onClick={() => context.onValueChange(value)}
      {...props}
    >
      {children}
    </div>
  )
})
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }

