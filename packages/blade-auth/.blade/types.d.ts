import type { CombinedInstructions, Expression } from 'blade-compiler';
import type { ReducedFunction } from 'blade/types';
import type { Account, Accounts, Session, Sessions } from 'blade/types';
export type { Account, Accounts, Session, Sessions };
declare namespace Utils {
  type AfterQuery<U> = ReducedFunction &
    (<T = U>(
      value: CombinedInstructions['after'],
      options?: Record<string, unknown>,
    ) => T);
  type AfterQueryPromise<U> = ReducedFunction &
    (<T = U>(
      value: CombinedInstructions['after'],
      options?: Record<string, unknown>,
    ) => Promise<T>);
  type BeforeQuery<U> = ReducedFunction &
    (<T = U>(
      value: CombinedInstructions['before'],
      options?: Record<string, unknown>,
    ) => T);
  type BeforeQueryPromise<U> = ReducedFunction &
    (<T = U>(
      value: CombinedInstructions['before'],
      options?: Record<string, unknown>,
    ) => Promise<T>);
  type IncludingQuery<U> = ReducedFunction &
    (<T = U>(
      value: CombinedInstructions['including'],
      options?: Record<string, unknown>,
    ) => T);
  type IncludingQueryPromise<U> = ReducedFunction &
    (<T = U>(
      value: CombinedInstructions['including'],
      options?: Record<string, unknown>,
    ) => Promise<T>);
  type LimitedToQuery<U> = ReducedFunction &
    (<T = U>(
      value: CombinedInstructions['limitedTo'],
      options?: Record<string, unknown>,
    ) => T);
  type LimitedToQueryPromise<U> = ReducedFunction &
    (<T = U>(
      value: CombinedInstructions['limitedTo'],
      options?: Record<string, unknown>,
    ) => Promise<T>);
  type OrderedByQuery<U, F extends string> = ReducedFunction &
    (<T = U>(
      instructions: {
        ascending?: Array<Expression | F>;
        descending?: Array<Expression | F>;
      },
      options?: Record<string, unknown>,
    ) => T) & {
      ascending: <T = U>(
        fields: Array<Expression | F>,
        options?: Record<string, unknown>,
      ) => T;
      descending: <T = U>(
        fields: Array<Expression | F>,
        options?: Record<string, unknown>,
      ) => T;
    };
  type OrderedByQueryPromise<U, F extends string> = ReducedFunction &
    (<T = U>(
      instructions: {
        ascending?: Array<Expression | F>;
        descending?: Array<Expression | F>;
      },
      options?: Record<string, unknown>,
    ) => Promise<T>) & {
      ascending: <T = U>(
        fields: Array<Expression | F>,
        options?: Record<string, unknown>,
      ) => Promise<T>;
      descending: <T = U>(
        fields: Array<Expression | F>,
        options?: Record<string, unknown>,
      ) => Promise<T>;
    };
  type ResultRecord = {
    /* The unique identifier of the record. */
    id: string;
    ronin: {
      /* The timestamp of when the record was created. */
      createdAt: string;
      /* The ID of the user who created the record. */
      createdBy: string | null;
      /* The timestamp of the last time the record was updated. */
      updatedAt: string;
      /* The ID of the user who last updated the record. */
      updatedBy: string | null;
    };
  };
  type RootQueryCaller<U> = <T = U>(
    instructions?: Partial<CombinedInstructions>,
    options?: Record<string, unknown>,
  ) => T;
  type RootQueryCallerPromise<U> = <T = U>(
    instructions?: Partial<CombinedInstructions>,
    options?: Record<string, unknown>,
  ) => Promise<T>;
  type SelectingQuery<U, F> = ReducedFunction &
    (<T = U>(instructions: Array<F>, options?: Record<string, unknown>) => T);
  type SelectingQueryPromise<U, F> = ReducedFunction &
    (<T = U>(instructions: Array<F>, options?: Record<string, unknown>) => Promise<T>);
  type ToQuery<U, S> = ReducedFunction &
    (<T = U>(instructions: Partial<S>, options?: Record<string, unknown>) => T);
  type ToQueryPromise<U, S> = ReducedFunction &
    (<T = U>(instructions: Partial<S>, options?: Record<string, unknown>) => Promise<T>);
  type WithQuery<U, S> = ReducedFunction & {
    <T = U>(
      instructions: Partial<S> | CombinedInstructions['with'],
      options?: Record<string, unknown>,
    ): T;
    id: <T = U>(value: ResultRecord['id'], options?: Record<string, unknown>) => T;
    ronin: ReducedFunction & {
      createdAt: <T = U>(
        value: ResultRecord['ronin']['createdAt'],
        options?: Record<string, unknown>,
      ) => T;
      createdBy: <T = U>(
        value: ResultRecord['ronin']['createdBy'],
        options?: Record<string, unknown>,
      ) => T;
      updatedAt: <T = U>(
        value: ResultRecord['ronin']['updatedAt'],
        options?: Record<string, unknown>,
      ) => T;
      updatedBy: <T = U>(
        value: ResultRecord['ronin']['updatedBy'],
        options?: Record<string, unknown>,
      ) => T;
    };
  };
  type WithQueryPromise<U, S> = ReducedFunction & {
    <T = U>(
      instructions: Partial<S> | CombinedInstructions['with'],
      options?: Record<string, unknown>,
    ): Promise<T>;
    id: <T = U>(
      value: ResultRecord['id'],
      options?: Record<string, unknown>,
    ) => Promise<T>;
    ronin: ReducedFunction & {
      createdAt: <T = U>(
        value: ResultRecord['ronin']['createdAt'],
        options?: Record<string, unknown>,
      ) => Promise<T>;
      createdBy: <T = U>(
        value: ResultRecord['ronin']['createdBy'],
        options?: Record<string, unknown>,
      ) => Promise<T>;
      updatedAt: <T = U>(
        value: ResultRecord['ronin']['updatedAt'],
        options?: Record<string, unknown>,
      ) => Promise<T>;
      updatedBy: <T = U>(
        value: ResultRecord['ronin']['updatedBy'],
        options?: Record<string, unknown>,
      ) => Promise<T>;
    };
  };
  type ResolveSchema<
    S,
    U extends Array<string> | 'all',
    K extends string,
  > = U extends 'all'
    ? S
    : K extends U[number]
      ? S
      : S extends Array<unknown>
        ? Array<string>
        : string;
}
declare namespace Syntax {
  type AddQuery = {
    /** Add a single Account record */
    account: ReducedFunction &
      Syntax.Account.Singular.RootQueryCallerPromise & {
        after: Syntax.Account.Singular.AfterQueryPromise;
        before: Syntax.Account.Singular.BeforeQueryPromise;
        including: Syntax.Account.Singular.IncludingQueryPromise;
        limitedTo: Syntax.Account.Singular.LimitedToQueryPromise;
        orderedBy: Syntax.Account.Singular.OrderedByQueryPromise;
        selecting: Syntax.Account.Singular.SelectingQueryPromise;
        to: Syntax.Account.Singular.ToQueryPromise;
        using: Syntax.Account.Singular.UsingQueryPromise;
        with: Syntax.Account.Singular.WithQueryPromise;
      };
    /** Add multiple Account records */
    accounts: ReducedFunction &
      Syntax.Account.Plural.RootQueryCallerPromise & {
        after: Syntax.Account.Plural.AfterQueryPromise;
        before: Syntax.Account.Plural.BeforeQueryPromise;
        including: Syntax.Account.Plural.IncludingQueryPromise;
        limitedTo: Syntax.Account.Plural.LimitedToQueryPromise;
        orderedBy: Syntax.Account.Plural.OrderedByQueryPromise;
        selecting: Syntax.Account.Plural.SelectingQueryPromise;
        to: Syntax.Account.Plural.ToQueryPromise;
        using: Syntax.Account.Plural.UsingQueryPromise;
        with: Syntax.Account.Plural.WithQueryPromise;
      };
    /** Add a single Session record */
    session: ReducedFunction &
      Syntax.Session.Singular.RootQueryCallerPromise & {
        after: Syntax.Session.Singular.AfterQueryPromise;
        before: Syntax.Session.Singular.BeforeQueryPromise;
        including: Syntax.Session.Singular.IncludingQueryPromise;
        limitedTo: Syntax.Session.Singular.LimitedToQueryPromise;
        orderedBy: Syntax.Session.Singular.OrderedByQueryPromise;
        selecting: Syntax.Session.Singular.SelectingQueryPromise;
        to: Syntax.Session.Singular.ToQueryPromise;
        using: Syntax.Session.Singular.UsingQueryPromise;
        with: Syntax.Session.Singular.WithQueryPromise;
      };
    /** Add multiple Session records */
    sessions: ReducedFunction &
      Syntax.Session.Plural.RootQueryCallerPromise & {
        after: Syntax.Session.Plural.AfterQueryPromise;
        before: Syntax.Session.Plural.BeforeQueryPromise;
        including: Syntax.Session.Plural.IncludingQueryPromise;
        limitedTo: Syntax.Session.Plural.LimitedToQueryPromise;
        orderedBy: Syntax.Session.Plural.OrderedByQueryPromise;
        selecting: Syntax.Session.Plural.SelectingQueryPromise;
        to: Syntax.Session.Plural.ToQueryPromise;
        using: Syntax.Session.Plural.UsingQueryPromise;
        with: Syntax.Session.Plural.WithQueryPromise;
      };
  };
  type GetQuery = {
    /** Get a single Account record */
    account: ReducedFunction &
      Syntax.Account.Singular.RootQueryCallerPromise & {
        after: Syntax.Account.Singular.AfterQueryPromise;
        before: Syntax.Account.Singular.BeforeQueryPromise;
        including: Syntax.Account.Singular.IncludingQueryPromise;
        limitedTo: Syntax.Account.Singular.LimitedToQueryPromise;
        orderedBy: Syntax.Account.Singular.OrderedByQueryPromise;
        selecting: Syntax.Account.Singular.SelectingQueryPromise;
        to: Syntax.Account.Singular.ToQueryPromise;
        using: Syntax.Account.Singular.UsingQueryPromise;
        with: Syntax.Account.Singular.WithQueryPromise;
      };
    /** Get multiple Account records */
    accounts: ReducedFunction &
      Syntax.Account.Plural.RootQueryCallerPromise & {
        after: Syntax.Account.Plural.AfterQueryPromise;
        before: Syntax.Account.Plural.BeforeQueryPromise;
        including: Syntax.Account.Plural.IncludingQueryPromise;
        limitedTo: Syntax.Account.Plural.LimitedToQueryPromise;
        orderedBy: Syntax.Account.Plural.OrderedByQueryPromise;
        selecting: Syntax.Account.Plural.SelectingQueryPromise;
        to: Syntax.Account.Plural.ToQueryPromise;
        using: Syntax.Account.Plural.UsingQueryPromise;
        with: Syntax.Account.Plural.WithQueryPromise;
      };
    /** Get a single Session record */
    session: ReducedFunction &
      Syntax.Session.Singular.RootQueryCallerPromise & {
        after: Syntax.Session.Singular.AfterQueryPromise;
        before: Syntax.Session.Singular.BeforeQueryPromise;
        including: Syntax.Session.Singular.IncludingQueryPromise;
        limitedTo: Syntax.Session.Singular.LimitedToQueryPromise;
        orderedBy: Syntax.Session.Singular.OrderedByQueryPromise;
        selecting: Syntax.Session.Singular.SelectingQueryPromise;
        to: Syntax.Session.Singular.ToQueryPromise;
        using: Syntax.Session.Singular.UsingQueryPromise;
        with: Syntax.Session.Singular.WithQueryPromise;
      };
    /** Get multiple Session records */
    sessions: ReducedFunction &
      Syntax.Session.Plural.RootQueryCallerPromise & {
        after: Syntax.Session.Plural.AfterQueryPromise;
        before: Syntax.Session.Plural.BeforeQueryPromise;
        including: Syntax.Session.Plural.IncludingQueryPromise;
        limitedTo: Syntax.Session.Plural.LimitedToQueryPromise;
        orderedBy: Syntax.Session.Plural.OrderedByQueryPromise;
        selecting: Syntax.Session.Plural.SelectingQueryPromise;
        to: Syntax.Session.Plural.ToQueryPromise;
        using: Syntax.Session.Plural.UsingQueryPromise;
        with: Syntax.Session.Plural.WithQueryPromise;
      };
  };
  type RemoveQuery = {
    /** Remove a single Account record */
    account: ReducedFunction &
      Syntax.Account.Singular.RootQueryCallerPromise & {
        after: Syntax.Account.Singular.AfterQueryPromise;
        before: Syntax.Account.Singular.BeforeQueryPromise;
        including: Syntax.Account.Singular.IncludingQueryPromise;
        limitedTo: Syntax.Account.Singular.LimitedToQueryPromise;
        orderedBy: Syntax.Account.Singular.OrderedByQueryPromise;
        selecting: Syntax.Account.Singular.SelectingQueryPromise;
        to: Syntax.Account.Singular.ToQueryPromise;
        using: Syntax.Account.Singular.UsingQueryPromise;
        with: Syntax.Account.Singular.WithQueryPromise;
      };
    /** Remove multiple Account records */
    accounts: ReducedFunction &
      Syntax.Account.Plural.RootQueryCallerPromise & {
        after: Syntax.Account.Plural.AfterQueryPromise;
        before: Syntax.Account.Plural.BeforeQueryPromise;
        including: Syntax.Account.Plural.IncludingQueryPromise;
        limitedTo: Syntax.Account.Plural.LimitedToQueryPromise;
        orderedBy: Syntax.Account.Plural.OrderedByQueryPromise;
        selecting: Syntax.Account.Plural.SelectingQueryPromise;
        to: Syntax.Account.Plural.ToQueryPromise;
        using: Syntax.Account.Plural.UsingQueryPromise;
        with: Syntax.Account.Plural.WithQueryPromise;
      };
    /** Remove a single Session record */
    session: ReducedFunction &
      Syntax.Session.Singular.RootQueryCallerPromise & {
        after: Syntax.Session.Singular.AfterQueryPromise;
        before: Syntax.Session.Singular.BeforeQueryPromise;
        including: Syntax.Session.Singular.IncludingQueryPromise;
        limitedTo: Syntax.Session.Singular.LimitedToQueryPromise;
        orderedBy: Syntax.Session.Singular.OrderedByQueryPromise;
        selecting: Syntax.Session.Singular.SelectingQueryPromise;
        to: Syntax.Session.Singular.ToQueryPromise;
        using: Syntax.Session.Singular.UsingQueryPromise;
        with: Syntax.Session.Singular.WithQueryPromise;
      };
    /** Remove multiple Session records */
    sessions: ReducedFunction &
      Syntax.Session.Plural.RootQueryCallerPromise & {
        after: Syntax.Session.Plural.AfterQueryPromise;
        before: Syntax.Session.Plural.BeforeQueryPromise;
        including: Syntax.Session.Plural.IncludingQueryPromise;
        limitedTo: Syntax.Session.Plural.LimitedToQueryPromise;
        orderedBy: Syntax.Session.Plural.OrderedByQueryPromise;
        selecting: Syntax.Session.Plural.SelectingQueryPromise;
        to: Syntax.Session.Plural.ToQueryPromise;
        using: Syntax.Session.Plural.UsingQueryPromise;
        with: Syntax.Session.Plural.WithQueryPromise;
      };
  };
  type SetQuery = {
    /** Set a single Account record */
    account: ReducedFunction &
      Syntax.Account.Singular.RootQueryCallerPromise & {
        after: Syntax.Account.Singular.AfterQueryPromise;
        before: Syntax.Account.Singular.BeforeQueryPromise;
        including: Syntax.Account.Singular.IncludingQueryPromise;
        limitedTo: Syntax.Account.Singular.LimitedToQueryPromise;
        orderedBy: Syntax.Account.Singular.OrderedByQueryPromise;
        selecting: Syntax.Account.Singular.SelectingQueryPromise;
        to: Syntax.Account.Singular.ToQueryPromise;
        using: Syntax.Account.Singular.UsingQueryPromise;
        with: Syntax.Account.Singular.WithQueryPromise;
      };
    /** Set multiple Account records */
    accounts: ReducedFunction &
      Syntax.Account.Plural.RootQueryCallerPromise & {
        after: Syntax.Account.Plural.AfterQueryPromise;
        before: Syntax.Account.Plural.BeforeQueryPromise;
        including: Syntax.Account.Plural.IncludingQueryPromise;
        limitedTo: Syntax.Account.Plural.LimitedToQueryPromise;
        orderedBy: Syntax.Account.Plural.OrderedByQueryPromise;
        selecting: Syntax.Account.Plural.SelectingQueryPromise;
        to: Syntax.Account.Plural.ToQueryPromise;
        using: Syntax.Account.Plural.UsingQueryPromise;
        with: Syntax.Account.Plural.WithQueryPromise;
      };
    /** Set a single Session record */
    session: ReducedFunction &
      Syntax.Session.Singular.RootQueryCallerPromise & {
        after: Syntax.Session.Singular.AfterQueryPromise;
        before: Syntax.Session.Singular.BeforeQueryPromise;
        including: Syntax.Session.Singular.IncludingQueryPromise;
        limitedTo: Syntax.Session.Singular.LimitedToQueryPromise;
        orderedBy: Syntax.Session.Singular.OrderedByQueryPromise;
        selecting: Syntax.Session.Singular.SelectingQueryPromise;
        to: Syntax.Session.Singular.ToQueryPromise;
        using: Syntax.Session.Singular.UsingQueryPromise;
        with: Syntax.Session.Singular.WithQueryPromise;
      };
    /** Set multiple Session records */
    sessions: ReducedFunction &
      Syntax.Session.Plural.RootQueryCallerPromise & {
        after: Syntax.Session.Plural.AfterQueryPromise;
        before: Syntax.Session.Plural.BeforeQueryPromise;
        including: Syntax.Session.Plural.IncludingQueryPromise;
        limitedTo: Syntax.Session.Plural.LimitedToQueryPromise;
        orderedBy: Syntax.Session.Plural.OrderedByQueryPromise;
        selecting: Syntax.Session.Plural.SelectingQueryPromise;
        to: Syntax.Session.Plural.ToQueryPromise;
        using: Syntax.Session.Plural.UsingQueryPromise;
        with: Syntax.Session.Plural.WithQueryPromise;
      };
  };
  namespace Account {
    type FieldSlug =
      | 'id'
      | 'ronin.createdAt'
      | 'ronin.createdBy'
      | 'ronin.updatedAt'
      | 'ronin.updatedBy'
      | 'id'
      | 'ronin.createdAt'
      | 'ronin.createdBy'
      | 'ronin.updatedAt'
      | 'ronin.updatedBy'
      | 'email'
      | 'emailVerified'
      | 'emailVerificationToken'
      | 'emailVerificationSentAt'
      | 'password';
    namespace Singular {
      type AfterQuery = Utils.AfterQuery<Account | null>;
      type AfterQueryPromise = Utils.AfterQueryPromise<Account | null>;
      type BeforeQuery = Utils.BeforeQuery<Account | null>;
      type BeforeQueryPromise = Utils.BeforeQueryPromise<Account | null>;
      type IncludingQuery = Utils.IncludingQuery<Account | null>;
      type IncludingQueryPromise = Utils.IncludingQueryPromise<Account | null>;
      type LimitedToQuery = Utils.LimitedToQuery<Account | null>;
      type LimitedToQueryPromise = Utils.LimitedToQueryPromise<Account | null>;
      type OrderedByQuery = Utils.OrderedByQuery<Account | null, Account.FieldSlug>;
      type OrderedByQueryPromise = Utils.OrderedByQueryPromise<
        Account | null,
        Account.FieldSlug
      >;
      type RootQueryCaller = Utils.RootQueryCaller<Account | null>;
      type RootQueryCallerPromise = Utils.RootQueryCallerPromise<Account | null>;
      type SelectingQuery = Utils.SelectingQuery<Account | null, Account.FieldSlug>;
      type SelectingQueryPromise = Utils.SelectingQueryPromise<
        Account | null,
        Account.FieldSlug
      >;
      type ToQuery = Utils.ToQuery<Account | null, Account>;
      type ToQueryPromise = Utils.ToQueryPromise<Account | null, Account>;
      type UsingQuery = ReducedFunction &
        (<T = Account | null>(value: CombinedInstructions['using']) => T);
      type UsingQueryPromise = ReducedFunction &
        (<T = Account | null>(value: CombinedInstructions['using']) => Promise<T>);
      type WithQuery = Utils.WithQuery<Account | null, Account> & {
        email: <T = Account | null>(
          email: Account['email'],
          options?: Record<string, unknown>,
        ) => T;
        emailVerified: <T = Account | null>(
          emailVerified: Account['emailVerified'],
          options?: Record<string, unknown>,
        ) => T;
        emailVerificationToken: <T = Account | null>(
          emailVerificationToken: Account['emailVerificationToken'],
          options?: Record<string, unknown>,
        ) => T;
        emailVerificationSentAt: <T = Account | null>(
          emailVerificationSentAt: Account['emailVerificationSentAt'],
          options?: Record<string, unknown>,
        ) => T;
        password: <T = Account | null>(
          password: Account['password'],
          options?: Record<string, unknown>,
        ) => T;
      };
      type WithQueryPromise = Utils.WithQueryPromise<Account | null, Account> & {
        email: <T = Account | null>(
          email: Account['email'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        emailVerified: <T = Account | null>(
          emailVerified: Account['emailVerified'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        emailVerificationToken: <T = Account | null>(
          emailVerificationToken: Account['emailVerificationToken'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        emailVerificationSentAt: <T = Account | null>(
          emailVerificationSentAt: Account['emailVerificationSentAt'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        password: <T = Account | null>(
          password: Account['password'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
      };
    }
    namespace Plural {
      type AfterQuery = Utils.AfterQuery<Accounts>;
      type AfterQueryPromise = Utils.AfterQueryPromise<Accounts>;
      type BeforeQuery = Utils.BeforeQuery<Accounts>;
      type BeforeQueryPromise = Utils.BeforeQueryPromise<Accounts>;
      type IncludingQuery = Utils.IncludingQuery<Accounts>;
      type IncludingQueryPromise = Utils.IncludingQueryPromise<Accounts>;
      type LimitedToQuery = Utils.LimitedToQuery<Accounts>;
      type LimitedToQueryPromise = Utils.LimitedToQueryPromise<Accounts>;
      type OrderedByQuery = Utils.OrderedByQuery<Accounts, Account.FieldSlug>;
      type OrderedByQueryPromise = Utils.OrderedByQueryPromise<
        Accounts,
        Account.FieldSlug
      >;
      type RootQueryCaller = Utils.RootQueryCaller<Accounts>;
      type RootQueryCallerPromise = Utils.RootQueryCallerPromise<Accounts>;
      type SelectingQuery = Utils.SelectingQuery<Accounts, Account.FieldSlug>;
      type SelectingQueryPromise = Utils.SelectingQueryPromise<
        Accounts,
        Account.FieldSlug
      >;
      type ToQuery = Utils.ToQuery<Accounts, Account>;
      type ToQueryPromise = Utils.ToQueryPromise<Accounts, Account>;
      type UsingQuery = ReducedFunction &
        (<T = Accounts>(value: CombinedInstructions['using']) => T);
      type UsingQueryPromise = ReducedFunction &
        (<T = Accounts>(value: CombinedInstructions['using']) => Promise<T>);
      type WithQuery = Utils.WithQuery<Accounts, Account> & {
        email: <T = Accounts>(
          email: Account['email'],
          options?: Record<string, unknown>,
        ) => T;
        emailVerified: <T = Accounts>(
          emailVerified: Account['emailVerified'],
          options?: Record<string, unknown>,
        ) => T;
        emailVerificationToken: <T = Accounts>(
          emailVerificationToken: Account['emailVerificationToken'],
          options?: Record<string, unknown>,
        ) => T;
        emailVerificationSentAt: <T = Accounts>(
          emailVerificationSentAt: Account['emailVerificationSentAt'],
          options?: Record<string, unknown>,
        ) => T;
        password: <T = Accounts>(
          password: Account['password'],
          options?: Record<string, unknown>,
        ) => T;
      };
      type WithQueryPromise = Utils.WithQueryPromise<Accounts, Account> & {
        email: <T = Accounts>(
          email: Account['email'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        emailVerified: <T = Accounts>(
          emailVerified: Account['emailVerified'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        emailVerificationToken: <T = Accounts>(
          emailVerificationToken: Account['emailVerificationToken'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        emailVerificationSentAt: <T = Accounts>(
          emailVerificationSentAt: Account['emailVerificationSentAt'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        password: <T = Accounts>(
          password: Account['password'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
      };
    }
  }
  namespace Session {
    type FieldSlug =
      | 'id'
      | 'ronin.createdAt'
      | 'ronin.createdBy'
      | 'ronin.updatedAt'
      | 'ronin.updatedBy'
      | 'id'
      | 'ronin.createdAt'
      | 'ronin.createdBy'
      | 'ronin.updatedAt'
      | 'ronin.updatedBy'
      | 'account'
      | 'browser'
      | 'browserVersion'
      | 'os'
      | 'osVersion'
      | 'deviceType';
    namespace Singular {
      type AfterQuery = Utils.AfterQuery<Session | null>;
      type AfterQueryPromise = Utils.AfterQueryPromise<Session | null>;
      type BeforeQuery = Utils.BeforeQuery<Session | null>;
      type BeforeQueryPromise = Utils.BeforeQueryPromise<Session | null>;
      type IncludingQuery = Utils.IncludingQuery<Session | null>;
      type IncludingQueryPromise = Utils.IncludingQueryPromise<Session | null>;
      type LimitedToQuery = Utils.LimitedToQuery<Session | null>;
      type LimitedToQueryPromise = Utils.LimitedToQueryPromise<Session | null>;
      type OrderedByQuery = Utils.OrderedByQuery<Session | null, Session.FieldSlug>;
      type OrderedByQueryPromise = Utils.OrderedByQueryPromise<
        Session | null,
        Session.FieldSlug
      >;
      type RootQueryCaller = Utils.RootQueryCaller<Session | null>;
      type RootQueryCallerPromise = Utils.RootQueryCallerPromise<Session | null>;
      type SelectingQuery = Utils.SelectingQuery<Session | null, Session.FieldSlug>;
      type SelectingQueryPromise = Utils.SelectingQueryPromise<
        Session | null,
        Session.FieldSlug
      >;
      type ToQuery = Utils.ToQuery<Session | null, Session>;
      type ToQueryPromise = Utils.ToQueryPromise<Session | null, Session>;
      type UsingQuery = ReducedFunction & {
        <U extends Array<'account'> | 'all'>(fields: U): Session<U> | null;
        <T = Session | null>(fields: Array<'account'> | 'all'): T;
      };
      type UsingQueryPromise = ReducedFunction & {
        <U extends Array<'account'> | 'all'>(fields: U): Promise<Session<U>> | null;
        <T = Session | null>(fields: Array<'account'> | 'all'): Promise<T>;
      };
      type WithQuery = Utils.WithQuery<Session | null, Session> & {
        account: <T = Session | null>(
          account: Session['account'] | Partial<Session<['account']>['account']>,
          options?: Record<string, unknown>,
        ) => T;
        browser: <T = Session | null>(
          browser: Session['browser'],
          options?: Record<string, unknown>,
        ) => T;
        browserVersion: <T = Session | null>(
          browserVersion: Session['browserVersion'],
          options?: Record<string, unknown>,
        ) => T;
        os: <T = Session | null>(
          os: Session['os'],
          options?: Record<string, unknown>,
        ) => T;
        osVersion: <T = Session | null>(
          osVersion: Session['osVersion'],
          options?: Record<string, unknown>,
        ) => T;
        deviceType: <T = Session | null>(
          deviceType: Session['deviceType'],
          options?: Record<string, unknown>,
        ) => T;
      };
      type WithQueryPromise = Utils.WithQueryPromise<Session | null, Session> & {
        account: <T = Session | null>(
          account: Session['account'] | Partial<Session<['account']>['account']>,
          options?: Record<string, unknown>,
        ) => Promise<T>;
        browser: <T = Session | null>(
          browser: Session['browser'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        browserVersion: <T = Session | null>(
          browserVersion: Session['browserVersion'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        os: <T = Session | null>(
          os: Session['os'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        osVersion: <T = Session | null>(
          osVersion: Session['osVersion'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        deviceType: <T = Session | null>(
          deviceType: Session['deviceType'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
      };
    }
    namespace Plural {
      type AfterQuery = Utils.AfterQuery<Sessions>;
      type AfterQueryPromise = Utils.AfterQueryPromise<Sessions>;
      type BeforeQuery = Utils.BeforeQuery<Sessions>;
      type BeforeQueryPromise = Utils.BeforeQueryPromise<Sessions>;
      type IncludingQuery = Utils.IncludingQuery<Sessions>;
      type IncludingQueryPromise = Utils.IncludingQueryPromise<Sessions>;
      type LimitedToQuery = Utils.LimitedToQuery<Sessions>;
      type LimitedToQueryPromise = Utils.LimitedToQueryPromise<Sessions>;
      type OrderedByQuery = Utils.OrderedByQuery<Sessions, Session.FieldSlug>;
      type OrderedByQueryPromise = Utils.OrderedByQueryPromise<
        Sessions,
        Session.FieldSlug
      >;
      type RootQueryCaller = Utils.RootQueryCaller<Sessions>;
      type RootQueryCallerPromise = Utils.RootQueryCallerPromise<Sessions>;
      type SelectingQuery = Utils.SelectingQuery<Sessions, Session.FieldSlug>;
      type SelectingQueryPromise = Utils.SelectingQueryPromise<
        Sessions,
        Session.FieldSlug
      >;
      type ToQuery = Utils.ToQuery<Sessions, Session>;
      type ToQueryPromise = Utils.ToQueryPromise<Sessions, Session>;
      type UsingQuery = ReducedFunction & {
        <U extends Array<'account'> | 'all'>(fields: U): Session<U>;
        <T = Sessions>(fields: Array<'account'> | 'all'): T;
      };
      type UsingQueryPromise = ReducedFunction & {
        <U extends Array<'account'> | 'all'>(fields: U): Promise<Session<U>>;
        <T = Sessions>(fields: Array<'account'> | 'all'): Promise<T>;
      };
      type WithQuery = Utils.WithQuery<Sessions, Session> & {
        account: <T = Sessions>(
          account: Session['account'] | Partial<Session<['account']>['account']>,
          options?: Record<string, unknown>,
        ) => T;
        browser: <T = Sessions>(
          browser: Session['browser'],
          options?: Record<string, unknown>,
        ) => T;
        browserVersion: <T = Sessions>(
          browserVersion: Session['browserVersion'],
          options?: Record<string, unknown>,
        ) => T;
        os: <T = Sessions>(os: Session['os'], options?: Record<string, unknown>) => T;
        osVersion: <T = Sessions>(
          osVersion: Session['osVersion'],
          options?: Record<string, unknown>,
        ) => T;
        deviceType: <T = Sessions>(
          deviceType: Session['deviceType'],
          options?: Record<string, unknown>,
        ) => T;
      };
      type WithQueryPromise = Utils.WithQueryPromise<Sessions, Session> & {
        account: <T = Sessions>(
          account: Session['account'] | Partial<Session<['account']>['account']>,
          options?: Record<string, unknown>,
        ) => Promise<T>;
        browser: <T = Sessions>(
          browser: Session['browser'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        browserVersion: <T = Sessions>(
          browserVersion: Session['browserVersion'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        os: <T = Sessions>(
          os: Session['os'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        osVersion: <T = Sessions>(
          osVersion: Session['osVersion'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
        deviceType: <T = Sessions>(
          deviceType: Session['deviceType'],
          options?: Record<string, unknown>,
        ) => Promise<T>;
      };
    }
  }
}
declare module 'blade/types' {
  export interface TriggerOptions {
    client: {
      add: Syntax.AddQuery;
      batch: any;
      count: any;
      get: Syntax.GetQuery;
      remove: Syntax.RemoveQuery;
      set: Syntax.SetQuery;
    };
  }
  export type Account = Utils.ResultRecord & {
    email: string;
    emailVerificationSentAt: Date;
    emailVerificationToken: string;
    emailVerified: boolean;
    password: string;
  };
  export type Accounts = Array<Account> & {
    moreBefore?: string;
    moreAfter?: string;
  };
  export type Session<U extends Array<'account'> | 'all' = []> = Utils.ResultRecord & {
    account: Utils.ResolveSchema<Account, U, 'account'>;
    browser: string;
    browserVersion: string;
    deviceType: string;
    os: string;
    osVersion: string;
  };
  export type Sessions<U extends Array<'account'> | 'all' = []> = Array<Session<U>> & {
    moreBefore?: string;
    moreAfter?: string;
  };
}
declare module 'blade/server/hooks' {
  declare const use: {
    /** Get a single Account record */
    account: ReducedFunction &
      Syntax.Account.Singular.RootQueryCaller & {
        after: Syntax.Account.Singular.AfterQuery;
        before: Syntax.Account.Singular.BeforeQuery;
        including: Syntax.Account.Singular.IncludingQuery;
        limitedTo: Syntax.Account.Singular.LimitedToQuery;
        orderedBy: Syntax.Account.Singular.OrderedByQuery;
        selecting: Syntax.Account.Singular.SelectingQuery;
        using: Syntax.Account.Singular.UsingQuery;
        with: Syntax.Account.Singular.WithQuery;
      };
    /** Get multiple Account records */
    accounts: ReducedFunction &
      Syntax.Account.Plural.RootQueryCaller & {
        after: Syntax.Account.Plural.AfterQuery;
        before: Syntax.Account.Plural.BeforeQuery;
        including: Syntax.Account.Plural.IncludingQuery;
        limitedTo: Syntax.Account.Plural.LimitedToQuery;
        orderedBy: Syntax.Account.Plural.OrderedByQuery;
        selecting: Syntax.Account.Plural.SelectingQuery;
        using: Syntax.Account.Plural.UsingQuery;
        with: Syntax.Account.Plural.WithQuery;
      };
    /** Get a single Session record */
    session: ReducedFunction &
      Syntax.Session.Singular.RootQueryCaller & {
        after: Syntax.Session.Singular.AfterQuery;
        before: Syntax.Session.Singular.BeforeQuery;
        including: Syntax.Session.Singular.IncludingQuery;
        limitedTo: Syntax.Session.Singular.LimitedToQuery;
        orderedBy: Syntax.Session.Singular.OrderedByQuery;
        selecting: Syntax.Session.Singular.SelectingQuery;
        using: Syntax.Session.Singular.UsingQuery;
        with: Syntax.Session.Singular.WithQuery;
      };
    /** Get multiple Session records */
    sessions: ReducedFunction &
      Syntax.Session.Plural.RootQueryCaller & {
        after: Syntax.Session.Plural.AfterQuery;
        before: Syntax.Session.Plural.BeforeQuery;
        including: Syntax.Session.Plural.IncludingQuery;
        limitedTo: Syntax.Session.Plural.LimitedToQuery;
        orderedBy: Syntax.Session.Plural.OrderedByQuery;
        selecting: Syntax.Session.Plural.SelectingQuery;
        using: Syntax.Session.Plural.UsingQuery;
        with: Syntax.Session.Plural.WithQuery;
      };
  };
}
declare module 'blade/client/hooks' {
  declare const useMutation: () => {
    add: Syntax.AddQuery;
    remove: Syntax.RemoveQuery;
    set: Syntax.SetQuery;
  };
}
