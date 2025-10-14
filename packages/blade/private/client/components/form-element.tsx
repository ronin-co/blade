import {
  type FunctionComponent,
  type MutableRefObject,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
} from 'react';

import { FormContext } from '@/private/client/components/form';
import { wrapClientComponent } from '@/private/client/utils/wrap-client';

interface FormElementProps extends PropsWithChildren {
  allowGlobalSave?: boolean;
}

// This component purely exists for the purpose of surrounding HTML input elements with
// an HTML form element in order to invoke JavaScript properties on the form and
// automatically read all its children fields like that. Please therefore refrain from
// adding any styling to it. As you can see in the places where the component is already
// used, it automatically adapts to its parent, especially when the parent is using flex.
const FormElement: FunctionComponent<FormElementProps> = ({
  children,
  allowGlobalSave,
}) => {
  const form = useContext(FormContext);
  if (!form) throw new Error('`FormElement` can only be used within `Form`.');

  const formId = useRef<string>('');
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    formId.current = form.registerForm(formRef as MutableRefObject<HTMLFormElement>);
    return () => form.unregisterForm(formId.current);
  }, []);

  // Listen to global ⌘+S events.
  useEffect(() => {
    if (!allowGlobalSave) return;

    const listener = async (event: KeyboardEvent) => {
      if (
        (window.navigator.userAgent.match('Mac') ? event.metaKey : event.ctrlKey) &&
        event.key === 's'
      ) {
        // Ignore default events.
        event.preventDefault();

        // Abort if the form is already submitting.
        if (form?.waiting) return;

        // If no form controls were found, abort.
        if (!form) return;

        await form.submit();
      }
    };

    document.addEventListener('keydown', listener, false);
    return () => document.removeEventListener('keydown', listener);
  }, [allowGlobalSave, form]);

  return (
    <form
      id={form.key}
      onKeyDown={(event) => {
        /**
         * When the user presses Ctrl+Enter (or Cmd+Enter on macOS) while focused
         * on an input field, we want to submit the form.
         */
        const focusedTagName = document.activeElement?.tagName;
        if (!focusedTagName) return;

        const isClosestForm = event.currentTarget.id === form.key;
        if (!isClosestForm) return;

        const isFocusedOnInput = ['INPUT', 'TEXTAREA'].includes(focusedTagName);
        const isCtrlOrCmdKey = window.navigator.userAgent.match('Mac')
          ? event.metaKey
          : event.ctrlKey;

        // Boolean indicating whether the user wants to save their current changes.
        const saveIntent = isCtrlOrCmdKey && event.key === 'Enter';

        if (saveIntent && isFocusedOnInput && !form.waiting) {
          form.submit();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();

        // Only execute `submit` if the form is not already submitting.
        if (form?.submit && !form?.waiting) form.submit();
      }}
      ref={formRef}>
      {children}

      {/* Submit form when ENTER is pressed. */}
      <button
        hidden
        type="submit"
      />
    </form>
  );
};

wrapClientComponent(FormElement, 'FormElement');

export { FormElement };
