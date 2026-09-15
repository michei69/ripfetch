import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { cn } from "../../lib/utils";

type NoticeProps = {
  title: string;
  /** Colour of the left rule. Omit for a neutral card. */
  tone?: "warn" | "danger";
  /** `alert` interrupts the screen reader; `status` waits for a pause. */
  role?: "alert" | "status";
  class?: string;
  /** Buttons or links that resolve the notice. */
  action?: JSX.Element;
  children: JSX.Element;
};

/**
 * The card behind every empty, failed or blocked state: a title, one line of
 * explanation, and an optional row of actions.
 */
export function Notice(props: NoticeProps) {
  return (
    <div
      class={cn("notice", props.class)}
      data-tone={props.tone}
      role={props.role ?? "status"}
    >
      <p class="notice-title">{props.title}</p>
      <p class="notice-body">{props.children}</p>
      <Show when={props.action}>
        <div class="notice-actions">{props.action}</div>
      </Show>
    </div>
  );
}
