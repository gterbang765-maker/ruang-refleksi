
import { useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from './supabaseClient'

const SENT_KEY = 'ruang-refleksi-sent-v1'

function formatDate(value) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function App() {
  const [page, setPage] = useState('home')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState({ type: '', text: '' })
  const [sending, setSending] = useState(false)
  const [alreadySent, setAlreadySent] = useState(
    () => localStorage.getItem(SENT_KEY) === 'yes',
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [session, setSession] = useState(null)
  const [loginBusy, setLoginBusy] = useState(false)
  const [adminError, setAdminError] = useState('')
  const [rows, setRows] = useState([])
  const [loadingRows, setLoadingRows] = useState(false)
  const [search, setSearch] = useState('')
  const [nameSort, setNameSort] = useState('az')
  const [timeSort, setTimeSort] = useState('newest')
  const [selected, setSelected] = useState([])
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!supabase) return undefined

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)

        if (!newSession) {
          setRows([])
          setSelected([])
        }
      },
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (page === 'admin' && session) loadMessages()
  }, [page, session])

  async function loadMessages() {
    if (!supabase || !session) return

    setLoadingRows(true)
    setAdminError('')

    const { data, error } = await supabase
      .from('feedback_messages')
      .select('id, name, message, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setAdminError(
        'Pesan gagal dimuat. Pastikan akunmu sudah didaftarkan sebagai admin di tabel admin_users.',
      )
    } else {
      setRows(data ?? [])
      setSelected([])
    }

    setLoadingRows(false)
  }

  async function submitFeedback(event) {
    event.preventDefault()
    setFeedback({ type: '', text: '' })

    if (!hasSupabaseConfig) {
      setFeedback({
        type: 'error',
        text: 'Database belum terhubung. Isi konfigurasi Supabase di file .env.local terlebih dahulu.',
      })
      return
    }

    if (alreadySent) {
      setFeedback({
        type: 'error',
        text: 'Browser ini sudah pernah mengirim pesan. Jika perlu pengujian ulang, hapus data situs dari browser.',
      })
      return
    }

    const cleanMessage = message.trim()

    if (!cleanMessage) {
      setFeedback({
        type: 'error',
        text: 'Pesan tidak boleh kosong.',
      })
      return
    }

    setSending(true)

    const { error } = await supabase
      .from('feedback_messages')
      .insert({
        name: name.trim() || 'Anonim',
        message: cleanMessage,
      })

    setSending(false)

    if (error) {
      setFeedback({
        type: 'error',
        text: 'Pesan belum terkirim. Coba dalam beberapa saat lagi.',
      })
      return
    }

    localStorage.setItem(SENT_KEY, 'yes')
    setAlreadySent(true)
    setName('')
    setMessage('')
    setFeedback({
      type: 'success',
      text: 'Pesan berhasil dikirim. Terima kasih masukannya!',
    })
  }

  async function loginAdmin(event) {
    event.preventDefault()
    setAdminError('')

    if (!supabase) {
      setAdminError(
        'Database belum terhubung. Lengkapi file .env.local terlebih dahulu.',
      )
      return
    }

    setLoginBusy(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoginBusy(false)
      setAdminError('Login gagal. Periksa email dan password admin.')
      return
    }

    const userId = data.user.id

    const { data: admin, error: adminCheckError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (adminCheckError || !admin) {
      await supabase.auth.signOut()
      setLoginBusy(false)
      setAdminError(
        'Akun ini belum terdaftar sebagai admin. Daftarkan UUID akun di tabel admin_users.',
      )
      return
    }

    setLoginBusy(false)
    setPassword('')
    setPage('admin')
  }

  async function logoutAdmin() {
    if (supabase) await supabase.auth.signOut()

    setSession(null)
    setPage('home')
    setRows([])
  }

  const visibleRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('id')

    const filtered = rows.filter((row) =>
      `${row.name} ${row.message}`.toLocaleLowerCase('id').includes(q),
    )

    filtered.sort((a, b) => {
      const nameCompare = a.name.localeCompare(b.name, 'id')
      if (nameCompare !== 0) {
        return nameSort === 'az' ? nameCompare : -nameCompare
      }
      return 0
    })

    filtered.sort((a, b) => {
      const dateCompare = new Date(a.created_at) - new Date(b.created_at)
      return timeSort === 'newest' ? -dateCompare : dateCompare
    })

    return filtered
  }, [rows, search, nameSort, timeSort])

  const anonymousCount = rows.filter((row) => row.name === 'Anonim').length

  function toggleRow(id) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  function toggleAllVisible() {
    const visibleIds = visibleRows.map((row) => row.id)
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selected.includes(id))

    setSelected((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    )
  }

  async function deleteSelected() {
    if (
      !selected.length ||
      !window.confirm(`Hapus ${selected.length} pesan terpilih?`)
    ) return

    setDeleting(true)

    const { error } = await supabase
      .from('feedback_messages')
      .delete()
      .in('id', selected)

    setDeleting(false)

    if (error) {
      setAdminError('Gagal menghapus pesan. Periksa hak akses admin.')
    } else {
      setRows((current) =>
        current.filter((row) => !selected.includes(row.id)),
      )
      setSelected([])
    }
  }

  async function deleteAll() {
    if (
      !rows.length ||
      !window.confirm(
        'Yakin menghapus SEMUA pesan? Tindakan ini tidak dapat dibatalkan.',
      )
    ) return

    setDeleting(true)

    const { error } = await supabase
      .from('feedback_messages')
      .delete()
      .gte('created_at', '1970-01-01T00:00:00Z')

    setDeleting(false)

    if (error) {
      setAdminError('Gagal menghapus semua pesan. Periksa hak akses admin.')
    } else {
      setRows([])
      setSelected([])
    }
  }

  function navigate(nextPage) {
    setFeedback({ type: '', text: '' })
    setAdminError('')
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => navigate('home')}
          aria-label="Kembali ke halaman utama"
        >
          <span className="brand-mark">✳</span>
          <span>
            <strong>Ruang Refleksi</strong>
            <small>TEMPAT UNTUK BERTUMBUH</small>
          </span>
        </button>
        <span className="top-pill">Kritik, Saran, Apresiasi</span>
      </header>

      <main className="container">
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-badge">
              REFLEKSI PRESENTASI KELOMPOK 5
            </div>

            <h1>
              Suaramu membantu kami{' '}
              <span>menjadi lebih baik.</span>
            </h1>

            <p>
              Punya masukan untuk presentasi kami? Sampaikan
              dengan jujur apa adanya. Kamu boleh menggunakan
              nama samaran atau mengirim pesan secara anonim.
            </p>

            <div className="group-card">
              <div className="group-card-label">
                ANGGOTA KELOMPOK KAMI
              </div>

              <div className="member-grid">
                <div className="member">
                  <img src="/anggota/dyan.jpeg" alt="Dyan" />
                  <h3>Dyan</h3>
                </div>

                <div className="member">
                  <img src="/anggota/my photo.jpeg" alt="Arya" />
                  <h3>Arya "the guy"</h3>
                </div>

                <div className="member">
                  <img src="/anggota/sri.jpeg" alt="Sri" />
                  <h3>Sri</h3>
                </div>

                <div className="member">
                  <img src="/anggota/tiara.jpeg" alt="Tiara" />
                  <h3>Tiara</h3>
                </div>
              </div>

              <div className="group-card-caption">
                Bersama belajar, mendengar, dan bertumbuh.
              </div>
            </div>
          </div>
        </div>

        {!hasSupabaseConfig && (
          <div className="notice warning">
            <strong>Setup database belum selesai.</strong>{' '}
            Website bisa kamu edit sekarang, tetapi fitur kirim pesan
            dan dashboard memerlukan konfigurasi Supabase di{' '}
            <code>.env.local</code>.
          </div>
        )}

        {page === 'home' && (
          <>
            <section className="section-heading">
              <div>
                <h2>Login sebagai</h2>
                <p>Pilih akses yang sesuai untuk melanjutkan.</p>
              </div>
            </section>

            <section className="role-grid">
              <button className="role-card" onClick={() => navigate('send')}>
                <span className="role-icon">✎</span>
                <span className="role-copy">
                  <strong>Pengirim pesan</strong>
                  <small>
                    Kirim kritik, saran, atau apresiasi. Boleh gunakan
                    nama samaran.
                  </small>
                </span>
                <span className="arrow">↗</span>
              </button>

              <button
                className="role-card"
                onClick={() => navigate(session ? 'admin' : 'login')}
              >
                <span className="role-icon">▦</span>
                <span className="role-copy">
                  <strong>Admin kelompok</strong>
                  <small>
                    Masuk untuk membaca dan mengelola pesan yang diterima.
                  </small>
                </span>
                <span className="arrow">↗</span>
              </button>
            </section>
          </>
        )}

        {page === 'send' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Kirim masukan</h2>
                <p>
                  Terima kasih atas masukannya, semoga bantalmu dingin terus.
                </p>
              </div>
              <button
                className="text-button"
                onClick={() => navigate('home')}
              >
                ← Kembali
              </button>
            </div>

            {feedback.text && (
              <div className={`notice ${feedback.type}`}>
                {feedback.text}
              </div>
            )}

            {alreadySent ? (
              <div className="success-state">
                <span>✓</span>
                <h3>Makasih loh ya!</h3>
                <p>
                  Browser ini sudah mengirim satu pesan. Developer 
                  membatasi pengguna mengirim pesan hanya sekali.
                </p>
              </div>
            ) : (
              <form onSubmit={submitFeedback}>
                <div className="field">
                  <label htmlFor="name">
                    Nama <span className="optional">(opsional)</span>
                  </label>
                  <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    placeholder="Contoh: Fufufafa / kosongkan untuk anonim"
                  />
                  <small>
                    Gunakan nama samaran jika tidak ingin menampilkan nama asli.
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="message">
                    Pesan kritik / saran <span className="required">*</span>
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    maxLength={2000}
                    placeholder="Apa yang sudah baik? Apa yang bisa kami perbaiki?"
                  />
                  <small className="counter">
                    {message.length}/2000 karakter
                  </small>
                </div>

                <div className="privacy-note">
                  <span>◈</span>
                  <p>
                    <strong>Privasi pengirim</strong>
                    <br />
                    Nama asli tidak diperlukan. Hindari membagikan informasi
                    pribadi yang sensitif.
                  </p>
                </div>

                <button
                  className="primary-button full-width"
                  disabled={sending}
                >
                  {sending ? 'Mengirim…' : 'Kirim pesan →'}
                </button>
              </form>
            )}
          </section>
        )}

        {page === 'login' && (
          <section className="panel narrow-panel">
            <div className="panel-header">
              <div>
                <h2>Login admin</h2>
                <p>Akses khusus untuk kelompok yang presentasi.</p>
              </div>
              <button
                className="text-button"
                onClick={() => navigate('home')}
              >
                ← Kembali
              </button>
            </div>

            {adminError && <div className="notice error">{adminError}</div>}

            <form onSubmit={loginAdmin}>
              <div className="field">
                <label htmlFor="email">Email admin</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="admin@sukacoklat.com"
                />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Masukkan password admin"
                />
              </div>

              <button
                className="primary-button full-width"
                disabled={loginBusy}
              >
                {loginBusy ? 'Memeriksa…' : 'Masuk ke dashboard →'}
              </button>
            </form>

            <p className="muted-note">
              Halaman ini khusus untuk admin.
            </p>
          </section>
        )}

        {page === 'admin' && (
          <section className="panel admin-panel">
            {!session ? (
              <div className="success-state">
                <h3>Perlu login</h3>
                <p>Silakan login sebagai admin untuk membuka dashboard.</p>
                <button
                  className="primary-button"
                  onClick={() => navigate('login')}
                >
                  Login admin
                </button>
              </div>
            ) : (
              <>
                <div className="panel-header">
                  <div>
                    <h2>Dashboard pesan</h2>
                    <p>Kelola kritik, saran, dan masukan dari users.</p>
                  </div>
                  <button className="secondary-button" onClick={logoutAdmin}>
                    Keluar
                  </button>
                </div>

                {adminError && <div className="notice error">{adminError}</div>}

                <div className="stats-grid">
                  <div className="stat-card">
                    <span>Total pesan</span>
                    <strong>{rows.length}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Nama anonim</span>
                    <strong>{anonymousCount}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Hasil pencarian</span>
                    <strong>{visibleRows.length}</strong>
                  </div>
                </div>

                <div className="toolbar">
                  <input
                    className="search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="⌕ Cari nama atau isi pesan…"
                    aria-label="Cari pesan"
                  />
                  <select
                    value={nameSort}
                    onChange={(e) => setNameSort(e.target.value)}
                    aria-label="Urutkan nama"
                  >
                    <option value="az">Nama: A–Z</option>
                    <option value="za">Nama: Z–A</option>
                  </select>
                  <select
                    value={timeSort}
                    onChange={(e) => setTimeSort(e.target.value)}
                    aria-label="Urutkan waktu"
                  >
                    <option value="newest">Terbaru</option>
                    <option value="oldest">Terlama</option>
                  </select>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setSearch('')
                      setNameSort('az')
                      setTimeSort('newest')
                    }}
                  >
                    Reset
                  </button>
                </div>

                <div className="toolbar actions-toolbar">
                  <button
                    className="secondary-button"
                    onClick={toggleAllVisible}
                  >
                    Pilih semua hasil
                  </button>
                  <button
                    className="danger-button"
                    onClick={deleteSelected}
                    disabled={!selected.length || deleting}
                  >
                    Hapus terpilih ({selected.length})
                  </button>
                  <button
                    className="danger-button"
                    onClick={deleteAll}
                    disabled={!rows.length || deleting}
                  >
                    Hapus semua data
                  </button>
                  <button
                    className="secondary-button"
                    onClick={loadMessages}
                    disabled={loadingRows}
                  >
                    {loadingRows ? 'Memuat…' : '↻ Muat ulang'}
                  </button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pilih</th>
                        <th>No.</th>
                        <th>Nama</th>
                        <th>Pesan</th>
                        <th>Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row, index) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.includes(row.id)}
                              onChange={() => toggleRow(row.id)}
                              aria-label={`Pilih pesan ${index + 1}`}
                            />
                          </td>
                          <td>{index + 1}</td>
                          <td className="name-cell">{row.name}</td>
                          <td className="message-cell">{row.message}</td>
                          <td className="time-cell">
                            {formatDate(row.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!loadingRows && visibleRows.length === 0 && (
                    <div className="empty-state">
                      <strong>Belum ada pesan yang cocok</strong>
                      <span>
                        Coba ubah kata kunci atau kirim pesan pertama.
                      </span>
                    </div>
                  )}

                  {loadingRows && (
                    <div className="empty-state">Memuat pesan…</div>
                  )}
                </div>

                <p className="muted-note">
                  Pengurutan nama dan waktu dapat dipakai bersamaan.
                  Penghapusan data bersifat permanen.
                </p>
              </>
            )}
          </section>
        )}

        <footer className="footer">
          Dirancang untuk refleksi presentasi kelompok, sampaikan dengan baik,
          terima dengan lapang dada.
        </footer>
      </main>
    </div>
  )
}

export default App