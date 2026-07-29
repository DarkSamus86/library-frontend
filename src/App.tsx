import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowBackRounded,
  AutoStoriesRounded,
  BookRounded,
  CheckCircleRounded,
  CloudUploadRounded,
  DashboardRounded,
  DeleteOutlineRounded,
  EditRounded,
  ErrorOutlineRounded,
  GridViewRounded,
  GroupRounded,
  Inventory2Outlined,
  LocalLibraryRounded,
  LogoutRounded,
  MenuRounded,
  PersonRounded,
  SearchRounded,
  TuneRounded,
} from '@mui/icons-material'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { z } from 'zod'
import { adminApi, authApi, booksApi, normalizeApiError, usersApi } from './api'
import { GuestOnly, RequireAdmin, RequireAuth, useAuth } from './auth'
import type { AdminUser, Book, BookPayload, UpdateProfileRequest } from './types'
import './App.css'

const money = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'KZT',
  maximumFractionDigits: 0,
})

function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><AuthPage mode="register" /></GuestOnly>} />
      <Route element={<AppLayout />}>
        <Route path="/books" element={<BooksPage />} />
        <Route path="/books/:id" element={<BookDetailsPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<EditProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/users/:id" element={<UserDetailsPage />} />
            <Route path="/admin/books" element={<AdminBooksPage />} />
            <Route path="/admin/books/new" element={<BookFormPage />} />
            <Route path="/admin/books/:id/edit" element={<BookFormPage />} />
            <Route path="/admin/import" element={<ImportPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/403" element={<StatusPage code="403" title="Доступ закрыт" text="У вашей учётной записи нет прав для просмотра этой страницы." />} />
      <Route path="/" element={<Navigate to="/books" replace />} />
      <Route path="*" element={<StatusPage code="404" title="Страница не найдена" text="Возможно, ссылка устарела или в адресе есть опечатка." />} />
    </Routes>
  )
}

const loginSchema = z.object({
  username: z.string().min(1, 'Введите имя пользователя'),
  password: z.string().min(1, 'Введите пароль'),
})
const registerSchema = loginSchema.extend({
  email: z.email('Введите корректный email'),
  username: z.string().min(3, 'Минимум 3 символа').max(50),
  password: z.string().min(8, 'Минимум 8 символов'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})
type AuthFields = z.infer<typeof registerSchema>

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isLogin = mode === 'login'
  const { establish } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [apiError, setApiError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AuthFields>({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema) as unknown as Resolver<AuthFields>,
    defaultValues: { username: '', password: '', email: '', firstName: '', lastName: '' },
  })
  const submit = async (values: AuthFields) => {
    setApiError('')
    try {
      const tokens = isLogin
        ? await authApi.login({ username: values.username, password: values.password })
        : await authApi.register(values)
      await establish(tokens)
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(destination || '/books', { replace: true })
    } catch (error) {
      setApiError(normalizeApiError(error))
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="О библиотеке">
        <Link className="brand brand-light" to="/"><span className="brand-mark"><AutoStoriesRounded /></span>Chapter</Link>
        <div className="story-copy">
          <span className="eyebrow light">Ваша личная библиотека</span>
          <h1>Истории, которые<br />остаются с вами.</h1>
          <p>Откройте для себя книги, к которым хочется возвращаться. Соберите свою полку знаний и впечатлений.</p>
        </div>
        <p className="story-quote">«Книга — это мечта, которую вы держите в руках»</p>
      </section>
      <section className="auth-panel">
        <div className="mobile-brand"><span className="brand-mark"><AutoStoriesRounded /></span>Chapter</div>
        <div className="auth-card">
          <span className="eyebrow">{isLogin ? 'С возвращением' : 'Новый читатель'}</span>
          <h2>{isLogin ? 'Войдите в аккаунт' : 'Создайте аккаунт'}</h2>
          <p className="muted">{isLogin ? 'Продолжите с того места, где остановились.' : 'Присоединяйтесь к сообществу любителей книг.'}</p>
          {apiError && <Notice tone="error">{apiError}</Notice>}
          <form onSubmit={handleSubmit(submit)} className="form-stack" noValidate>
            {!isLogin && (
              <div className="field-row">
                <Field label="Имя" error={errors.firstName?.message}><input {...register('firstName')} autoComplete="given-name" placeholder="Анна" /></Field>
                <Field label="Фамилия" error={errors.lastName?.message}><input {...register('lastName')} autoComplete="family-name" placeholder="Иванова" /></Field>
              </div>
            )}
            {!isLogin && <Field label="Email" error={errors.email?.message}><input {...register('email')} type="email" autoComplete="email" placeholder="name@example.com" /></Field>}
            <Field label="Имя пользователя" error={errors.username?.message}><input {...register('username')} autoComplete="username" placeholder="Ваш логин" /></Field>
            <Field label="Пароль" error={errors.password?.message} hint={!isLogin ? 'Не менее 8 символов' : undefined}><input {...register('password')} type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="••••••••" /></Field>
            <button className="button primary wide" disabled={isSubmitting}>{isSubmitting ? 'Подождите…' : isLogin ? 'Войти' : 'Создать аккаунт'}</button>
          </form>
          <p className="auth-switch">{isLogin ? 'Ещё нет аккаунта?' : 'Уже есть аккаунт?'} <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Зарегистрироваться' : 'Войти'}</Link></p>
        </div>
      </section>
    </main>
  )
}

function AppLayout() {
  const { user, loading, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const initials = `${user?.firstName?.[0] || user?.username[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase()
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/books"><span className="brand-mark"><AutoStoriesRounded /></span>Chapter</Link>
        <button className="icon-button menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Открыть меню"><MenuRounded /></button>
        <nav className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Основная навигация" onClick={() => setMenuOpen(false)}>
          <NavLink to="/books"><BookRounded />Каталог</NavLink>
          {user && <NavLink to="/profile"><PersonRounded />Профиль</NavLink>}
          {user?.roles.includes('ROLE_ADMIN') && <NavLink to="/admin"><DashboardRounded />Управление</NavLink>}
        </nav>
        {user ? (
          <div className="user-menu">
            <Link to="/profile" className="avatar">{initials}</Link>
            <div><strong>{user.firstName || user.username}</strong><small>{user.roles.includes('ROLE_ADMIN') ? 'Администратор' : 'Читатель'}</small></div>
            <button className="icon-button" onClick={() => void logout()} aria-label="Выйти"><LogoutRounded /></button>
          </div>
        ) : (
          <div className="user-menu">
            {!loading && <Link className="button secondary" to="/login">Войти</Link>}
          </div>
        )}
      </header>
      {location.pathname.startsWith('/admin') && <AdminNav />}
      <main className="page"><Outlet /></main>
    </div>
  )
}

function AdminNav() {
  return (
    <aside className="admin-nav">
      <NavLink end to="/admin"><GridViewRounded />Обзор</NavLink>
      <NavLink to="/admin/users"><GroupRounded />Пользователи</NavLink>
      <NavLink to="/admin/books"><Inventory2Outlined />Книги</NavLink>
      <NavLink to="/admin/import"><CloudUploadRounded />Импорт</NavLink>
    </aside>
  )
}

function PageHeader({ eyebrow, title, text, action, back }: { eyebrow?: string; title: string; text?: string; action?: ReactNode; back?: string }) {
  return (
    <header className="page-header">
      <div>
        {back && <Link className="back-link" to={back}><ArrowBackRounded />Назад</Link>}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {action && <div className="header-action">{action}</div>}
    </header>
  )
}

function BooksPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(0, Number(params.get('page') || 0))
  const size = [10, 20, 50].includes(Number(params.get('size'))) ? Number(params.get('size')) : 10
  const sort = params.get('sort') || 'title,asc'
  const title = params.get('title') || ''
  const [search, setSearch] = useState(title)
  const listQuery = useQuery({
    queryKey: ['books', 'list', { page, size, sort, title }],
    queryFn: async () => {
      if (!title) return booksApi.list({ page, size, sort })
      const content = await booksApi.search(title)
      return {
        content,
        totalElements: content.length,
        totalPages: 1,
        size: content.length,
        number: 0,
        first: true,
        last: true,
        numberOfElements: content.length,
        empty: content.length === 0,
      }
    },
  })
  const books = listQuery.data?.content || []
  const totalPages = listQuery.data?.totalPages || 0
  const total = listQuery.data?.totalElements || 0
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '0')
    setParams(next)
  }
  const doSearch = (event: FormEvent) => {
    event.preventDefault()
    update('title', search.trim())
  }
  return (
    <>
      <section className="catalog-hero">
        <span className="eyebrow">Библиотечный фонд</span>
        <h1>Найдите свою<br /><em>следующую историю</em></h1>
        <p>Классика, современная проза и профессиональная литература — всё в одном месте.</p>
        <form className="search-bar" onSubmit={doSearch}>
          <SearchRounded />
          <input aria-label="Поиск по названию" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Название книги…" />
          <button className="button primary">Найти</button>
        </form>
      </section>
      <div className="catalog-toolbar">
        <div><span className="eyebrow">Коллекция</span><h2>{title ? `Результаты «${title}»` : 'Все книги'}</h2><p>{total} книг в каталоге</p></div>
        <label className="select-label"><TuneRounded />Сортировка
          <select value={sort} onChange={(e) => update('sort', e.target.value)}>
            <option value="title,asc">По названию А–Я</option>
            <option value="title,desc">По названию Я–А</option>
            <option value="publishedYear,desc">Сначала новые</option>
            <option value="pricePurchase,asc">Сначала дешевле</option>
          </select>
        </label>
      </div>
      {listQuery.isPending ? <BookGridSkeleton /> : listQuery.isError ? <QueryError error={listQuery.error} retry={() => void listQuery.refetch()} /> : books.length === 0 ? <EmptyState icon={<SearchRounded />} title="Ничего не нашли" text="Попробуйте изменить запрос или сбросить поиск." action={title && <button className="button secondary" onClick={() => { setSearch(''); update('title', '') }}>Сбросить поиск</button>} /> : (
        <div className="book-grid">{books.map((book) => <BookCard key={book.id} book={book} />)}</div>
      )}
      {!title && totalPages > 0 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => update('page', String(page - 1))}>← Назад</button>
          <span>Страница <strong>{page + 1}</strong> из {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => update('page', String(page + 1))}>Вперёд →</button>
          <label>Показывать <select value={size} onChange={(e) => update('size', e.target.value)}><option>10</option><option>20</option><option>50</option></select></label>
        </div>
      )}
    </>
  )
}

function BookCard({ book }: { book: Book }) {
  return (
    <article className="book-card">
      <Link to={`/books/${book.id}`} className="cover-wrap">
        <BookCover book={book} />
        <span className={`availability ${book.isAvailableForPurchase || book.isAvailableForRent ? '' : 'unavailable'}`}>{book.isAvailableForPurchase || book.isAvailableForRent ? 'Доступна' : 'Нет в наличии'}</span>
      </Link>
      <div className="book-card-body">
        <p className="book-meta">{book.publishedYear || 'Год не указан'} · {book.hasDigital ? 'Электронная' : 'Печатная'}</p>
        <h3><Link to={`/books/${book.id}`}>{book.title}</Link></h3>
        <p className="clamp">{book.description || 'Описание книги пока не добавлено.'}</p>
        <div className="book-card-footer"><strong>{money.format(book.pricePurchase)}</strong><Link aria-label={`Открыть ${book.title}`} to={`/books/${book.id}`}>Подробнее →</Link></div>
      </div>
    </article>
  )
}

function BookCover({ book, large = false }: { book: Pick<Book, 'title' | 'coverImageUrl'>; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (book.coverImageUrl && !failed) return <img className={large ? 'book-cover large' : 'book-cover'} src={book.coverImageUrl} alt={`Обложка книги «${book.title}»`} loading="lazy" onError={() => setFailed(true)} />
  return <div className={`cover-fallback ${large ? 'large' : ''}`} aria-label={`Обложка книги «${book.title}»`}><AutoStoriesRounded /><span>{book.title}</span><small>Chapter edition</small></div>
}

function BookDetailsPage() {
  const id = Number(useParams().id)
  const query = useQuery({ queryKey: ['books', 'detail', id], queryFn: () => booksApi.get(id), enabled: Number.isFinite(id) })
  if (query.isPending) return <BookDetailsSkeleton />
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />
  const book = query.data
  return (
    <>
      <div className="detail-back"><Link className="back-link" to="/books"><ArrowBackRounded />Назад в каталог</Link></div>
      <article className="book-detail">
        <div className="detail-cover"><BookCover book={book} large /></div>
        <div className="detail-copy">
          <span className="eyebrow">{book.publishedYear ? `Издание ${book.publishedYear} года` : 'Из библиотечного фонда'}</span>
          <h1>{book.title}</h1>
          <div className="detail-badges">
            {book.hasPhysical && <span>Печатная</span>}{book.hasDigital && <span>Электронная</span>}
          </div>
          <p className="description">{book.description || 'Описание этой книги пока не добавлено.'}</p>
          <div className="price-panel">
            <div><small>Стоимость книги</small><strong>{money.format(book.pricePurchase)}</strong></div>
            <button className="button disabled" disabled>Получить книгу <small>Скоро</small></button>
          </div>
          <dl className="facts">
            <div><dt>ISBN</dt><dd>{book.isbn || 'Не указан'}</dd></div>
            <div><dt>Печатных экземпляров</dt><dd>{book.physicalInventory}</dd></div>
            <div><dt>Цифровых лицензий</dt><dd>{book.digitalLicenses === -1 ? 'Без ограничений' : book.digitalLicenses}</dd></div>
            <div><dt>Аренда</dt><dd>{book.isAvailableForRent ? `Доступна${book.priceRental != null ? ` · ${money.format(book.priceRental)}` : ''}` : 'Недоступна'}</dd></div>
            <div><dt>Залог</dt><dd>{book.depositAmount != null ? money.format(book.depositAmount) : 'Не требуется'}</dd></div>
            <div><dt>Выдано / куплено</dt><dd>{book.totalRentalsCount} / {book.totalPurchasesCount}</dd></div>
          </dl>
        </div>
      </article>
    </>
  )
}

function ProfilePage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <>
      <PageHeader eyebrow="Личный кабинет" title="Ваш профиль" text="Данные учётной записи и настройки безопасности." action={<Link className="button primary" to="/profile/edit"><EditRounded />Редактировать</Link>} />
      <section className="profile-grid">
        <div className="profile-card identity-card">
          <div className="profile-avatar">{(user.firstName?.[0] || user.username[0]).toUpperCase()}</div>
          <span className="status-dot">Активный аккаунт</span>
          <h2>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.username}</h2>
          <p>@{user.username}</p>
          <div className="role-list">{user.roles.map((role) => <span key={role}>{role === 'ROLE_ADMIN' ? 'Администратор' : 'Читатель'}</span>)}</div>
        </div>
        <div className="profile-card">
          <h2>Контактные данные</h2>
          <dl className="profile-data">
            <div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Статус email</dt><dd>{user.isEmailVerified ? 'Подтверждён' : 'Не подтверждён'}</dd></div>
            <div><dt>Имя пользователя</dt><dd>{user.username}</dd></div>
          </dl>
          <div className="profile-actions"><Link to="/change-password">Изменить пароль</Link></div>
        </div>
      </section>
    </>
  )
}

function EditProfilePage() {
  const { user, clearSession, setProfile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: usersApi.updateMe,
    onSuccess: async (updatedUser, values) => {
      if (values.username !== undefined && values.username !== user?.username) {
        await clearSession()
        navigate('/login', { replace: true })
      } else {
        setProfile(updatedUser)
        queryClient.setQueryData(['current-user', updatedUser.id], updatedUser)
        await queryClient.invalidateQueries({
          queryKey: ['current-user', updatedUser.id],
        })
        navigate('/profile')
      }
    },
    onError: (err) => setError(normalizeApiError(err)),
  })
  if (!user) return null
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values: Required<UpdateProfileRequest> = {
      email: String(form.get('email')),
      username: String(form.get('username')),
      firstName: String(form.get('firstName')),
      lastName: String(form.get('lastName')),
    }
    const changes: UpdateProfileRequest = {}
    for (const key of Object.keys(values) as (keyof UpdateProfileRequest)[]) {
      if (values[key] !== (user[key] ?? '')) changes[key] = values[key]
    }
    mutation.mutate(changes)
  }
  return (
    <>
      <PageHeader eyebrow="Настройки" title="Редактирование профиля" text="После изменения логина потребуется войти заново." back="/profile" />
      <form className="content-form" onSubmit={submit}>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="field-row"><Field label="Имя"><input name="firstName" defaultValue={user.firstName || ''} /></Field><Field label="Фамилия"><input name="lastName" defaultValue={user.lastName || ''} /></Field></div>
        <Field label="Email"><input name="email" type="email" required defaultValue={user.email} /></Field>
        <Field label="Имя пользователя"><input name="username" minLength={3} maxLength={50} required defaultValue={user.username} /></Field>
        <div className="form-actions"><Link className="button secondary" to="/profile">Отмена</Link><button className="button primary" disabled={mutation.isPending}>{mutation.isPending ? 'Сохраняем…' : 'Сохранить изменения'}</button></div>
      </form>
    </>
  )
}

function ChangePasswordPage() {
  const { clearSession } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: usersApi.changePassword,
    onSuccess: async () => {
      await clearSession()
      navigate('/login', { replace: true })
    },
    onError: (err) => {
      const message = normalizeApiError(err)
      setError(
        message === 'Current password is incorrect' ||
          message === 'Неверные данные или сессия завершена'
          ? 'Неверный текущий пароль'
          : message,
      )
    },
  })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const newPassword = String(data.get('newPassword'))
    if (newPassword !== String(data.get('repeatPassword'))) return setError('Новые пароли не совпадают')
    mutation.mutate({ currentPassword: String(data.get('currentPassword')), newPassword })
  }
  return (
    <>
      <PageHeader eyebrow="Безопасность" title="Смена пароля" text="После смены пароля мы завершим текущую сессию." back="/profile" />
      <form className="content-form compact" onSubmit={submit}>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Текущий пароль"><input name="currentPassword" type="password" required /></Field>
        <Field label="Новый пароль" hint="Не менее 8 символов"><input name="newPassword" type="password" minLength={8} required /></Field>
        <Field label="Повторите новый пароль"><input name="repeatPassword" type="password" minLength={8} required /></Field>
        <div className="form-actions"><Link className="button secondary" to="/profile">Отмена</Link><button className="button primary" disabled={mutation.isPending}>Изменить пароль</button></div>
      </form>
    </>
  )
}

function DashboardPage() {
  const query = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminApi.dashboard })
  if (query.isPending) return <StatsSkeleton />
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />
  const data = query.data
  const stats = [
    ['Всего пользователей', data.totalUsers, <GroupRounded />],
    ['Активных читателей', data.activeUsers, <CheckCircleRounded />],
    ['Книг в каталоге', data.totalBooks, <BookRounded />],
    ['Активных книг', data.activeBooks, <LocalLibraryRounded />],
  ] as const
  return (
    <>
      <PageHeader eyebrow="Панель управления" title="Обзор библиотеки" text="Главные показатели и быстрые действия." />
      <div className="stats-grid">{stats.map(([label, value, icon]) => <article className="stat-card" key={label}><span>{icon}</span><p>{label}</p><strong>{value}</strong></article>)}</div>
      <div className="dashboard-grid">
        <section className="panel"><h2>Пользователи по ролям</h2>{Object.entries(data.usersByRole).map(([role, count]) => <div className="role-stat" key={role}><span>{role === 'ROLE_ADMIN' ? 'Администраторы' : 'Читатели'}</span><strong>{count}</strong><div><i style={{ width: `${Math.max(6, count / Math.max(1, data.totalUsers) * 100)}%` }} /></div></div>)}</section>
        <section className="panel quick-actions"><h2>Быстрые действия</h2><Link to="/admin/books/new"><BookRounded />Добавить новую книгу<span>→</span></Link><Link to="/admin/import"><CloudUploadRounded />Запустить импорт<span>→</span></Link><Link to="/admin/users"><GroupRounded />Управлять пользователями<span>→</span></Link></section>
      </div>
    </>
  )
}

function UsersPage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') || 0)
  const query = useQuery({ queryKey: ['admin', 'users', page], queryFn: () => adminApi.users({ page, size: 20, sort: 'createdAt,desc' }) })
  return (
    <>
      <PageHeader eyebrow="Администрирование" title="Пользователи" text="Учётные записи, роли и статусы." />
      {query.isPending ? <TableSkeleton /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : query.data.content.length === 0 ? <EmptyState icon={<GroupRounded />} title="Пользователей пока нет" text="Новые аккаунты появятся здесь после регистрации." /> : (
        <>
          <div className="table-wrap"><table><thead><tr><th>Пользователь</th><th>Статус</th><th>Роли</th><th>Регистрация</th><th><span className="sr-only">Действия</span></th></tr></thead><tbody>{query.data.content.map((user) => <tr key={user.id}><td><strong>{user.username}</strong><small>{user.email}</small></td><td><StatusPill active={user.isActive}>{user.isActive ? 'Активен' : 'Отключён'}</StatusPill></td><td><div className="role-list">{user.roles.map((role) => <span key={role}>{role.replace('ROLE_', '')}</span>)}</div></td><td>{formatDate(user.createdAt)}</td><td><Link className="table-link" to={`/admin/users/${user.id}`}>Открыть →</Link></td></tr>)}</tbody></table></div>
          <div className="pagination"><button disabled={query.data.first} onClick={() => setParams({ page: String(page - 1) })}>← Назад</button><span>Страница {page + 1} из {query.data.totalPages}</span><button disabled={query.data.last} onClick={() => setParams({ page: String(page + 1) })}>Вперёд →</button></div>
        </>
      )}
    </>
  )
}

function UserDetailsPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminApi.user(id) })
  const update = useMutation({
    mutationFn: async ({ type, user }: { type: 'status' | 'roles'; user: AdminUser }) => {
      if (type === 'status') await adminApi.status(user.id, !user.isActive)
      else {
        const roles = user.roles.includes('ROLE_ADMIN') ? ['ROLE_USER'] : [...new Set([...user.roles, 'ROLE_ADMIN'])]
        await adminApi.roles(user.id, roles)
      }
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['admin'] }) },
  })
  const remove = useMutation({ mutationFn: adminApi.deleteUser, onSuccess: () => navigate('/admin/users') })
  if (query.isPending) return <StatsSkeleton />
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />
  const user = query.data
  return (
    <>
      <PageHeader title={user.username} eyebrow="Карточка пользователя" text={user.email} back="/admin/users" action={<StatusPill active={user.isActive}>{user.isActive ? 'Активен' : 'Отключён'}</StatusPill>} />
      {(update.error || remove.error) && <Notice tone="error">{normalizeApiError(update.error || remove.error)}</Notice>}
      <div className="dashboard-grid">
        <section className="panel"><h2>Данные аккаунта</h2><dl className="profile-data"><div><dt>Имя</dt><dd>{[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Не указано'}</dd></div><div><dt>Email подтверждён</dt><dd>{user.isEmailVerified ? 'Да' : 'Нет'}</dd></div><div><dt>Создан</dt><dd>{formatDate(user.createdAt)}</dd></div><div><dt>Обновлён</dt><dd>{formatDate(user.updatedAt)}</dd></div></dl></section>
        <section className="panel"><h2>Управление доступом</h2><p className="muted">Текущие роли</p><div className="role-list large">{user.roles.map((role) => <span key={role}>{role}</span>)}</div><div className="vertical-actions"><button className="button secondary" disabled={update.isPending} onClick={() => update.mutate({ type: 'roles', user })}>{user.roles.includes('ROLE_ADMIN') ? 'Убрать роль администратора' : 'Сделать администратором'}</button><button className="button warning" disabled={update.isPending} onClick={() => { if (confirm(`${user.isActive ? 'Отключить' : 'Активировать'} пользователя ${user.username}?`)) update.mutate({ type: 'status', user }) }}>{user.isActive ? 'Деактивировать аккаунт' : 'Активировать аккаунт'}</button><button className="button danger" disabled={remove.isPending} onClick={() => { if (confirm(`Удалить пользователя ${user.username}? Это действие необратимо.`)) remove.mutate(user.id) }}><DeleteOutlineRounded />Удалить пользователя</button></div></section>
      </div>
    </>
  )
}

function AdminBooksPage() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['books', 'admin-list'], queryFn: () => booksApi.list({ page: 0, size: 50, sort: 'title,asc' }) })
  const remove = useMutation({
    mutationFn: ({ id, hard }: { id: number; hard: boolean }) => hard ? booksApi.hardDelete(id) : booksApi.softDelete(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['books'] }),
  })
  const removeBook = (book: Book, hard: boolean) => {
    if (hard) {
      const title = prompt(`Полное удаление необратимо. Введите название книги:\n${book.title}`)
      if (title !== book.title) return
    } else if (!confirm(`Скрыть книгу «${book.title}» из каталога?`)) return
    remove.mutate({ id: book.id, hard })
  }
  return (
    <>
      <PageHeader eyebrow="Управление фондом" title="Книги" text="Добавляйте, редактируйте и снимайте книги с публикации." action={<Link className="button primary" to="/admin/books/new">+ Добавить книгу</Link>} />
      {remove.error && <Notice tone="error">{normalizeApiError(remove.error)}</Notice>}
      {query.isPending ? <TableSkeleton /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : (
        <div className="table-wrap"><table><thead><tr><th>Книга</th><th>Год</th><th>Цена</th><th>Остаток</th><th>Действия</th></tr></thead><tbody>{query.data.content.map((book) => <tr key={book.id}><td><strong>{book.title}</strong><small>{book.isbn || 'ISBN не указан'}</small></td><td>{book.publishedYear || '—'}</td><td>{money.format(book.pricePurchase)}</td><td>{book.physicalInventory} / {book.digitalLicenses === -1 ? '∞' : book.digitalLicenses}</td><td><div className="row-actions"><Link className="icon-button" to={`/admin/books/${book.id}/edit`} aria-label="Редактировать"><EditRounded /></Link><button className="icon-button" onClick={() => removeBook(book, false)} aria-label="Снять с публикации"><DeleteOutlineRounded /></button><button className="text-danger" onClick={() => removeBook(book, true)}>Удалить полностью</button></div></td></tr>)}</tbody></table></div>
      )}
    </>
  )
}

const genres = ['Fantasy', 'Science Fiction', 'Detective', 'Romance', 'Thriller', 'Horror', 'Adventure', 'Mystery', 'Historical Fiction', 'Non-Fiction', 'Biography', 'Self-Help', 'Philosophy', 'Poetry', 'Drama', 'Comedy', 'Dystopia', 'Young Adult', 'Children', 'Classic']
const categories = ['Programming', 'Java', 'Spring', 'Backend', 'Software Engineering']

function BookFormPage() {
  const id = Number(useParams().id)
  const editing = Number.isFinite(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['books', 'detail', id], queryFn: () => booksApi.get(id), enabled: editing })
  const mutation = useMutation({
    mutationFn: (payload: BookPayload) => editing ? booksApi.update(id, payload) : booksApi.create(payload),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['books'] }); navigate('/admin/books') },
  })
  if (editing && query.isPending) return <StatsSkeleton />
  if (editing && query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />
  const book = query.data
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const number = (key: string) => data.get(key) === '' ? undefined : Number(data.get(key))
    mutation.mutate({
      title: String(data.get('title')),
      description: String(data.get('description') || ''),
      isbn: String(data.get('isbn') || ''),
      ...(!editing && { author: String(data.get('author')), genre: String(data.get('genre')), category: String(data.get('category') || '') }),
      pricePurchase: Number(data.get('pricePurchase')),
      priceRental: number('priceRental'),
      depositAmount: number('depositAmount'),
      physicalInventory: Number(data.get('physicalInventory')),
      digitalLicenses: data.get('unlimited') ? -1 : number('digitalLicenses'),
      hasPhysical: Boolean(data.get('hasPhysical')),
      hasDigital: Boolean(data.get('hasDigital')),
      publishedYear: number('publishedYear'),
      coverImageUrl: String(data.get('coverImageUrl') || ''),
      ...(editing && { isAvailableForRent: Boolean(data.get('isAvailableForRent')), isAvailableForPurchase: Boolean(data.get('isAvailableForPurchase')) }),
    })
  }
  return (
    <>
      <PageHeader eyebrow="Книжный фонд" title={editing ? 'Редактирование книги' : 'Новая книга'} text={editing ? 'Измените информацию и доступность книги.' : 'Заполните сведения для добавления в каталог.'} back="/admin/books" />
      <form className="content-form book-form" onSubmit={submit}>
        {mutation.error && <Notice tone="error">{normalizeApiError(mutation.error)}</Notice>}
        <section><h2>Основная информация</h2><Field label="Название"><input name="title" required maxLength={255} defaultValue={book?.title} /></Field><Field label="Описание"><textarea name="description" rows={5} defaultValue={book?.description || ''} /></Field><div className="field-row"><Field label="ISBN"><input name="isbn" maxLength={50} defaultValue={book?.isbn || ''} /></Field><Field label="Год публикации"><input name="publishedYear" type="number" min="1000" max="2099" defaultValue={book?.publishedYear || ''} /></Field></div>{!editing && <><div className="field-row"><Field label="Автор"><input name="author" required maxLength={255} /></Field><Field label="Жанр"><select name="genre" required><option value="">Выберите жанр</option>{genres.map((item) => <option key={item}>{item}</option>)}</select></Field></div><Field label="Категория" hint="Можно выбрать только существующую категорию"><select name="category"><option value="">Без категории</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></Field></>}</section>
        <section><h2>Цена и наличие</h2><div className="field-row three"><Field label="Цена покупки"><input name="pricePurchase" required type="number" min="0" step="0.01" defaultValue={book?.pricePurchase ?? 0} /></Field><Field label="Цена аренды"><input name="priceRental" type="number" min="0" step="0.01" defaultValue={book?.priceRental ?? ''} /></Field><Field label="Залог"><input name="depositAmount" type="number" min="0" step="0.01" defaultValue={book?.depositAmount ?? ''} /></Field></div><div className="check-grid"><label><input name="hasPhysical" type="checkbox" defaultChecked={book?.hasPhysical ?? true} /> Печатный формат</label><label><input name="hasDigital" type="checkbox" defaultChecked={book?.hasDigital ?? true} /> Электронный формат</label>{editing && <><label><input name="isAvailableForRent" type="checkbox" defaultChecked={book?.isAvailableForRent} /> Доступна аренда</label><label><input name="isAvailableForPurchase" type="checkbox" defaultChecked={book?.isAvailableForPurchase} /> Доступна покупка</label></>}</div><div className="field-row"><Field label="Печатных экземпляров"><input name="physicalInventory" required type="number" min="0" step="1" defaultValue={book?.physicalInventory ?? 0} /></Field><Field label="Цифровых лицензий"><input name="digitalLicenses" type="number" min="0" step="1" defaultValue={book?.digitalLicenses === -1 ? 0 : book?.digitalLicenses ?? 0} /><label className="inline-check"><input name="unlimited" type="checkbox" defaultChecked={book?.digitalLicenses === -1} /> Без ограничений</label></Field></div></section>
        <section><h2>Обложка</h2><Field label="Ссылка на изображение"><input name="coverImageUrl" type="url" placeholder="https://…" defaultValue={book?.coverImageUrl || ''} /></Field></section>
        <div className="form-actions"><Link className="button secondary" to="/admin/books">Отмена</Link><button className="button primary" disabled={mutation.isPending}>{mutation.isPending ? 'Сохраняем…' : editing ? 'Сохранить' : 'Добавить книгу'}</button></div>
      </form>
    </>
  )
}

function ImportPage() {
  const [success, setSuccess] = useState(false)
  const mutation = useMutation({ mutationFn: booksApi.import, onSuccess: () => setSuccess(true) })
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload = { query: String(data.get('query') || ''), title: String(data.get('title') || ''), author: String(data.get('author') || ''), limit: Number(data.get('limit') || 20) }
    if (!payload.query && !payload.title && !payload.author) return
    setSuccess(false)
    mutation.mutate(payload)
  }
  return (
    <>
      <PageHeader eyebrow="Open Library" title="Импорт книг" text="Запустите фоновый поиск и добавление книг из внешнего каталога." />
      <div className="import-layout">
        <form className="content-form compact" onSubmit={submit}>
          {success && <Notice tone="success">Импорт запущен. Новые книги появятся в каталоге после обработки.</Notice>}
          {mutation.error && <Notice tone="error">{normalizeApiError(mutation.error)}</Notice>}
          <Field label="Общий поисковый запрос" hint="Например: clean code"><input name="query" placeholder="Тема, ключевые слова…" /></Field>
          <div className="form-or">или уточните</div>
          <Field label="Название книги"><input name="title" placeholder="Название" /></Field>
          <Field label="Автор"><input name="author" placeholder="Имя автора" /></Field>
          <Field label="Количество книг"><input name="limit" type="number" min="1" max="100" defaultValue="20" /></Field>
          <button className="button primary wide" disabled={mutation.isPending}><CloudUploadRounded />{mutation.isPending ? 'Запускаем…' : 'Запустить импорт'}</button>
        </form>
        <aside className="info-card"><CloudUploadRounded /><h2>Как это работает?</h2><ol><li>Мы отправим запрос в Open Library.</li><li>Backend поставит задачу в очередь.</li><li>Обработанные книги появятся в каталоге.</li></ol><p>Статус и процент выполнения пока недоступны — обновите список через некоторое время.</p><Link className="button secondary" to="/admin/books">Открыть список книг</Link></aside>
      </div>
    </>
  )
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return <label className={`field ${error ? 'has-error' : ''}`}><span>{label}</span>{children}{(error || hint) && <small>{error || hint}</small>}</label>
}

function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{tone === 'error' ? <ErrorOutlineRounded /> : <CheckCircleRounded />}{children}</div>
}

function StatusPill({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className={`status-pill ${active ? 'active' : ''}`}>{children}</span>
}

function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span>{icon}</span><h2>{title}</h2><p>{text}</p>{action}</div>
}

function QueryError({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="empty-state error-state"><span><ErrorOutlineRounded /></span><h2>Не удалось загрузить данные</h2><p>{normalizeApiError(error)}</p><button className="button secondary" onClick={retry}>Попробовать снова</button></div>
}

function BookGridSkeleton() {
  return <div className="book-grid">{Array.from({ length: 8 }, (_, index) => <div className="book-card skeleton-card" key={index}><div className="skeleton cover" /><div className="book-card-body"><div className="skeleton line short" /><div className="skeleton line" /><div className="skeleton line" /></div></div>)}</div>
}
function TableSkeleton() { return <div className="panel">{Array.from({ length: 6 }, (_, i) => <div className="skeleton line table-line" key={i} />)}</div> }
function StatsSkeleton() { return <div className="stats-grid">{Array.from({ length: 4 }, (_, i) => <div className="stat-card" key={i}><div className="skeleton line" /><div className="skeleton line short" /></div>)}</div> }
function BookDetailsSkeleton() { return <div className="book-detail"><div className="skeleton detail-cover" /><div className="detail-copy"><div className="skeleton line short" /><div className="skeleton line" /><div className="skeleton line" /><div className="skeleton line" /></div></div> }

function StatusPage({ code, title, text }: { code: string; title: string; text: string }) {
  return <main className="status-page"><Link className="brand" to="/"><span className="brand-mark"><AutoStoriesRounded /></span>Chapter</Link><strong>{code}</strong><h1>{title}</h1><p>{text}</p><Link className="button primary" to="/books">Вернуться в каталог</Link></main>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value))
}

export default App
