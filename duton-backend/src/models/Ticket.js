// Ticket Priority Enum
export const TicketPriority = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

// Ticket Status Enum
export const TicketStatus = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

// Validation functions for tickets
export function validateIssueType(issueType) {
  if (!issueType || typeof issueType !== "string") {
    throw new Error("issue_type is required");
  }
  if (issueType.length < 3 || issueType.length > 200) {
    throw new Error("issue_type must be between 3 and 200 characters");
  }
  return true;
}

export function validateDescription(description) {
  if (!description || typeof description !== "string") {
    throw new Error("description is required");
  }
  if (description.length < 5) {
    throw new Error("description must be at least 5 characters");
  }
  return true;
}

export function validateMessage(message) {
  if (!message || typeof message !== "string") {
    throw new Error("message is required");
  }
  if (message.length < 2) {
    throw new Error("message must be at least 2 characters");
  }
  return true;
}

