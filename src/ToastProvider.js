// @flow

import React, {
  Component,
  // $FlowFixMe `useContext`
  useContext,
  type ComponentType,
  type Node,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { Transition, TransitionGroup } from 'react-transition-group';

import { ToastController } from './ToastController';
import { ToastContainer, type ToastContainerProps } from './ToastContainer';
import { type ToastProps, DefaultToast } from './ToastElement';
const defaultComponents = { Toast: DefaultToast, ToastContainer };

import { generateUEID, NOOP } from './utils';
import type {
  AddFn,
  UpdateFn,
  RemoveFn,
  Callback,
  ToastsType,
  Options,
  Placement,
  Id,
} from './types';
import {useState} from "react";
import {useCallback} from "react";

// $FlowFixMe `createContext`
const ToastContext = React.createContext();
const { Consumer, Provider } = ToastContext;

const canUseDOM = !!(
  typeof window !== 'undefined' &&
  window.document &&
  window.document.createElement
);

// Provider
// ==============================

type Components = {
  Toast: ComponentType<ToastProps>,
  ToastContainer: ComponentType<ToastContainerProps>,
};
type Props = {
  // A convenience prop; the time until a toast will be dismissed automatically, in milliseconds.
  // Note that specifying this will override any defaults set on individual children Toasts.
  autoDismissTimeout: number,
  // Whether or not to dismiss the toast automatically after `autoDismissTimeout`.
  autoDismiss: boolean,
  // Unrelated app content
  children: Node,
  // Component replacement object
  components: Components,
  // When true, insert new toasts at the top of the stack
  newestOnTop: boolean,
  // Where, in relation to the viewport, to place the toasts
  placement: Placement,
  // Which element to attach the container's portal to, defaults to the `body`.
  portalTargetSelector?: string,
  // A convenience prop; the duration of the toast transition, in milliseconds.
  // Note that specifying this will override any defaults set on individual children Toasts.
  transitionDuration: number,
};
type State = { toasts: ToastsType };
type Context = {
  add: AddFn,
  remove: RemoveFn,
  removeAll: () => void,
  update: UpdateFn,
  toasts: Array<Object>,
};

export function ToastProvider({
                                autoDismiss: inheritedAutoDismiss = false,
                                autoDismissTimeout = 5000,
                                children,
                                components = defaultComponents,
                                placement = 'top-right',
                                newestOnTop = false,
                                portalTargetSelector,
                                transitionDuration = 220
                              } : Props

) {
    const [state, setState] = useState({ toasts: [] });

    // Internal Helpers
    // ------------------------------
    const has = useCallback((id: string) => {
      if (!state.toasts.length) {
        return false;
      }

      return Boolean(state.toasts.filter(t => t.id === id).length);
    }, [state.toasts]);
    const add = useCallback((content: Node, options?: Options = {}, cb: Callback = NOOP) => {
      const id = options.id ? options.id : generateUEID();
      const callback = () => cb(id);

      // bail if a toast exists with this ID
      if (has(id)) {
        return;
      }

      // update the toast stack

      Promise.resolve()
      .then(() => {
        setState(state => {
          const newToast = { content, id, ...options };
          const toasts = newestOnTop ? [newToast, ...state.toasts] : [...state.toasts, newToast];
          return { toasts };
        });
      })
      .then(() => callback())

      // consumer may want to do something with the generated ID (and not use the callback)
      return id;
    }, [has, state] );

    const remove = useCallback((id: Id, cb: Callback = NOOP) => {
      const callback = () => cb(id);

      // bail if NO toasts exists with this ID
      if (!has(id)) {
        return;
      }

      Promise.resolve()
      .then(() => {
        setState(state => {
          const toasts = state.toasts.filter(t => t.id !== id);
          return { toasts };
      });

      })
      .then(() => callback())


    }, [has, state]);

    const onDismissCB = useCallback((id: Id, cb: Callback = NOOP) => {
      cb(id);
      remove(id);
    }, [remove]);

    const removeAll = useCallback( () => {
      if (!state.toasts.length) {
        return;
      }

      state.toasts.forEach(t => remove(t.id));
    }, [state.toasts, remove]);

    const update = useCallback( (id: Id, options?: Options = {}, cb: Callback = NOOP) => {
      const callback = () => cb(id);

      // bail if NO toasts exists with this ID
      if (!has(id)) {
        return;
      }

      // update the toast stack

      Promise.resolve()
      .then(() => {
        setState(state => {
          const old = state.toasts;
          const i = old.findIndex(t => t.id === id);
          const updatedToast = { ...old[i], ...options };
          const toasts = [...old.slice(0, i), updatedToast, ...old.slice(i + 1)];
          return { toasts };
        });
      })
      .then(() => callback())
    }, [has, state]);

    const { Toast, ToastContainer } = { ...defaultComponents, ...components };
    const toasts = Object.freeze(state.toasts);

    const hasToasts = Boolean(toasts.length);
    const portalTarget = canUseDOM
      ? portalTargetSelector
        ? document.querySelector(portalTargetSelector)
        : document.body
      : null; // appease flow

    return (
      <Provider value={{ add, remove, removeAll, update, toasts }}>
        {children}

        {portalTarget ? (
          createPortal(
            <ToastContainer placement={placement} hasToasts={hasToasts}>
              <TransitionGroup component={null}>
                {toasts.map(
                  ({
                    appearance,
                    autoDismiss,
                    content,
                    id,
                    onDismiss,
                    ...unknownConsumerProps
                  }) => {
                        // In order to avoid the following warning:
                        // Warning: findDOMNode is deprecated in StrictMode. findDOMNode was passed an instance of Transition which is inside StrictMode. Instead, add a ref directly to the element you want to reference.
                        // https://stackoverflow.com/questions/60903335/warning-finddomnode-is-deprecated-in-strictmode-finddomnode-was-passed-an-inst
                        const nodeRef = React.createRef();

                      return <Transition
                          appear
                          key={id}
                          mountOnEnter
                          timeout={transitionDuration}
                          unmountOnExit
                          nodeRef={nodeRef}
                      >
                          {transitionState => (
                              <ToastController
                                  appearance={appearance}
                                  autoDismiss={
                                      autoDismiss !== undefined
                                          ? autoDismiss
                                          : inheritedAutoDismiss
                                  }
                                  autoDismissTimeout={autoDismissTimeout}
                                  component={Toast}
                                  key={id}
                                  onDismiss={() => onDismissCB(id, onDismiss)}
                                  placement={placement}
                                  transitionDuration={transitionDuration}
                                  transitionState={transitionState}
                                  {...unknownConsumerProps}
                              >
                                  <div ref={nodeRef}>
                                    {content}
                                  </div>
                              </ToastController>
                          )}
                      </Transition>
                  }
                )}
              </TransitionGroup>
            </ToastContainer>,
            portalTarget
          )
        ) : (
          <ToastContainer placement={placement} hasToasts={hasToasts} /> // keep ReactDOM.hydrate happy
        )}
      </Provider>
    );
}


export const ToastConsumer = ({ children }: { children: Context => Node }) => (
  <Consumer>{context => children(context)}</Consumer>
);

export const withToastManager = (Comp: ComponentType<*>) =>
  // $FlowFixMe `forwardRef`
  React.forwardRef((props: *, ref: Ref<*>) => (
    <ToastConsumer>
      {context => <Comp toastManager={context} {...props} ref={ref} />}
    </ToastConsumer>
  ));

export const useToasts = () => {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw Error(
      'The `useToasts` hook must be called from a descendent of the `ToastProvider`.'
    );
  }

  return {
    addToast: ctx.add,
    removeToast: ctx.remove,
    removeAllToasts: ctx.removeAll,
    updateToast: ctx.update,
    toastStack: ctx.toasts,
  };
};
