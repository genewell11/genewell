import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  TrendingUp,
  DollarSign,
  Mail,
  LogOut,
  AlertCircle,
  Loader,
  Download,
  FileSpreadsheet,
  ClipboardList,
  Settings,
  Eye,
  Key,
  Globe,
  MapPin,
  Package,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DashboardStats {
  totalUsers: number;
  totalQuizAttempts: number;
  totalQuizResponses: number;
  totalPurchases: number;
  completedPurchases: number;
  totalRevenue: number;
  totalDownloads: number;
  emailStats: Record<string, number>;
}

interface RecentPurchase {
  id: number;
  user_id: number;
  total_price: number;
  payment_status: string;
  created_at: string;
  email: string;
  name: string;
  plan_id: string;
}

interface AdminUser {
  id: number;
  email: string;
  name: string;
  age?: number;
  gender?: string;
  phone?: string;
  location?: string;
  quiz_count: number;
  purchase_count: number;
  download_count: number;
  total_spend: number;
  created_at: string;
}

interface QuizSubmission {
  id: number;
  user_name: string;
  user_email: string;
  user_phone: string;
  user_age: number;
  user_gender: string;
  user_location: string;
  analysis_id: string;
  quiz_data: any;
  ip_address: string;
  created_at: string;
}

interface DownloadRecord {
  id: number;
  user_email: string;
  user_name: string;
  phone: string;
  age?: number;
  location?: string;
  product_name: string;
  plan_tier: string;
  email_sent: boolean;
  created_at: string;
  pdf_record_id?: string;
  analysis_id?: string;
  download_url?: string;
}

interface VisitorRecord {
  id: number;
  ip_address: string;
  country: string;
  region: string;
  city: string;
  timezone: string;
  isp: string;
  page_visited: string;
  referrer: string;
  user_agent: string;
  is_bot: boolean;
  created_at: string;
}

interface TrafficDemographics {
  totalVisits: number;
  uniqueVisitors: number;
  todayTotal: number;
  todayUnique: number;
  botVisits: number;
  byCountry: { country: string; visits: string }[];
  byCity: { city: string; region: string; country: string; visits: string }[];
  daily: { date: string; visits: string }[];
}

interface ManagedProduct {
  id: number;
  plan_id: string;
  name: string;
  description: string;
  details: string[];
  price: number;
  original_price: number;
  color: string;
  icon: string;
  page_count: number;
  badge: string;
  popular: boolean;
  visible: boolean;
  sort_order: number;
  created_at: string;
}

interface ManagedAddon {
  id: number;
  addon_id: string;
  name: string;
  description: string;
  features: string[];
  price: number;
  original_price: number;
  icon: string;
  page_count_addition: number;
  visible: boolean;
  sort_order: number;
  created_at: string;
}

type TabType = 'overview' | 'users' | 'quiz' | 'purchases' | 'downloads' | 'traffic' | 'products' | 'addons' | 'settings';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmission[]>([]);
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [trafficDemographics, setTrafficDemographics] = useState<TrafficDemographics | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [expandedQuiz, setExpandedQuiz] = useState<number | null>(null);
  const [managedProducts, setManagedProducts] = useState<ManagedProduct[]>([]);
  const [editingProduct, setEditingProduct] = useState<Partial<ManagedProduct> | null>(null);
  const [managedAddons, setManagedAddons] = useState<ManagedAddon[]>([]);
  const [editingAddon, setEditingAddon] = useState<Partial<ManagedAddon> | null>(null);
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({});
  const [settingsDraft, setSettingsDraft] = useState<Record<string, string>>({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');

  const apiHeaders = useCallback(() => ({
    'X-Admin-Token': adminToken,
    'Content-Type': 'application/json',
  }), [adminToken]);

  const handleLogin = async () => {
    if (!loginUsername || !loginPassword) {
      setError('Please enter username and password');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Login failed');

      localStorage.setItem('adminToken', data.token);
      setAdminToken(data.token);
      setIsAuthenticated(true);
      setAdminUsername(data.username || loginUsername);
      setLoginUsername('');
      setLoginPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/dashboard', {
        headers: { 'X-Admin-Token': adminToken },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          localStorage.removeItem('adminToken');
          return;
        }
        throw new Error('Failed to load dashboard');
      }

      const data = await response.json();
      setStats(data.statistics);
      setRecentPurchases(data.recentPurchases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [adminToken]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/users?limit=200', { headers: { 'X-Admin-Token': adminToken } });
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuizSubmissions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/quiz-responses?limit=200', { headers: { 'X-Admin-Token': adminToken } });
      if (!response.ok) throw new Error('Failed to load quiz data');
      const data = await response.json();
      setQuizSubmissions(data.quizResponses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quiz data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDownloads = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/downloads?limit=200', { headers: { 'X-Admin-Token': adminToken } });
      if (!response.ok) throw new Error('Failed to load downloads');
      const data = await response.json();
      setDownloads(data.downloads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load downloads');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTraffic = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/traffic?limit=200', { headers: { 'X-Admin-Token': adminToken } });
      if (!response.ok) throw new Error('Failed to load traffic data');
      const data = await response.json();
      setVisitors(data.visitors);
      setTrafficDemographics(data.demographics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load traffic data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPurchases = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/purchases?limit=200', { headers: { 'X-Admin-Token': adminToken } });
      if (!response.ok) throw new Error('Failed to load purchases');
      const data = await response.json();
      setRecentPurchases(data.purchases);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchases');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async (tokenOverride?: string) => {
    const token = tokenOverride || adminToken || localStorage.getItem('adminToken') || '';
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/products', { headers: { 'X-Admin-Token': token } });
      if (response.status === 401) {
        setIsAuthenticated(false);
        setError('Session expired. Please log in again.');
        return;
      }
      if (!response.ok) throw new Error('Failed to load products');
      const data = await response.json();
      setManagedProducts(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAddons = async (tokenOverride?: string) => {
    const token = tokenOverride || adminToken || localStorage.getItem('adminToken') || '';
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/addons', { headers: { 'X-Admin-Token': token } });
      if (response.status === 401) {
        setIsAuthenticated(false);
        setError('Session expired. Please log in again.');
        return;
      }
      if (!response.ok) throw new Error('Failed to load add-ons');
      const data = await response.json();
      setManagedAddons(data.addons || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load add-ons');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAddon = async () => {
    if (!editingAddon) return;
    setIsLoading(true);
    setError('');
    try {
      const price = parseFloat(String(editingAddon.price || 0));
      if (price < 99 || price > 399) {
        setError('Price must be between ₹99 and ₹399');
        setIsLoading(false);
        return;
      }
      const isNew = !editingAddon.id;
      const url = isNew ? '/api/admin/addons' : `/api/admin/addons/${editingAddon.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const response = await fetch(url, {
        method,
        headers: apiHeaders(),
        body: JSON.stringify(editingAddon),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save add-on');
      }
      setEditingAddon(null);
      setSuccess(isNew ? 'Add-on created!' : 'Add-on updated!');
      loadAddons();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save add-on');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAddon = async (id: number) => {
    if (!confirm('Delete this add-on?')) return;
    try {
      const response = await fetch(`/api/admin/addons/${id}`, { method: 'DELETE', headers: apiHeaders() });
      if (!response.ok) throw new Error('Failed to delete add-on');
      setSuccess('Add-on deleted!');
      loadAddons();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete add-on');
    }
  };

  const handleToggleAddonVisibility = async (id: number) => {
    try {
      await fetch(`/api/admin/addons/${id}/toggle-visibility`, { method: 'POST', headers: apiHeaders() });
      loadAddons();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle add-on');
    }
  };

  const loadSiteSettings = async () => {
    try {
      const response = await fetch('/api/admin/site-settings', { headers: { 'X-Admin-Token': adminToken } });
      if (!response.ok) throw new Error('Failed to load site settings');
      const data = await response.json();
      const settingsMap: Record<string, string> = {};
      (data.settings || []).forEach((s: any) => { settingsMap[s.setting_key] = s.setting_value; });
      setSiteSettings(settingsMap);
      setSettingsDraft(settingsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    }
  };

  const handleSaveSiteSettings = async () => {
    setSettingsSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/site-settings/bulk', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ settings: settingsDraft }),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      setSiteSettings({ ...settingsDraft });
      setSuccess('Site settings saved! Changes will appear on the website immediately.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    setIsLoading(true);
    setError('');
    try {
      const isNew = !editingProduct.id;
      const url = isNew ? '/api/admin/products' : `/api/admin/products/${editingProduct.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const response = await fetch(url, {
        method,
        headers: apiHeaders(),
        body: JSON.stringify(editingProduct),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save product');
      }
      setEditingProduct(null);
      setSuccess(isNew ? 'Product created successfully!' : 'Product updated successfully!');
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleVisibility = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/products/${id}/toggle-visibility`, {
        method: 'POST',
        headers: apiHeaders(),
      });
      if (!response.ok) throw new Error('Failed to toggle visibility');
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle visibility');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: apiHeaders(),
      });
      if (!response.ok) throw new Error('Failed to delete product');
      setSuccess('Product deleted successfully!');
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminToken('');
    setIsAuthenticated(false);
    setStats(null);
    setUsers([]);
  };

  const [resendingEmail, setResendingEmail] = useState<number | null>(null);

  const handleResendEmail = async (downloadId: number) => {
    setResendingEmail(downloadId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/resend-download-email', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ downloadId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to resend email');
      setSuccess(data.message || 'Email sent successfully!');
      loadDownloads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend email');
    } finally {
      setResendingEmail(null);
    }
  };

  const handleExportExcel = async (type: string) => {
    try {
      const response = await fetch(`/api/admin/export/excel?type=${type}`, {
        headers: { 'X-Admin-Token': adminToken },
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword) {
      setError('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Password change failed');

      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetch('/api/admin/dashboard', { headers: { 'X-Admin-Token': adminToken } })
        .then(res => {
          if (res.ok) {
            setIsAuthenticated(true);
            return res.json();
          }
          throw new Error('Invalid session');
        })
        .then(data => {
          setStats(data.statistics);
          setRecentPurchases(data.recentPurchases);
        })
        .catch(() => {
          localStorage.removeItem('adminToken');
          setAdminToken('');
        });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && adminToken) {
      if (activeTab === 'overview') loadDashboard();
      if (activeTab === 'users') loadUsers();
      if (activeTab === 'quiz') loadQuizSubmissions();
      if (activeTab === 'purchases') { loadPurchases(); loadDownloads(); }
      if (activeTab === 'downloads') loadDownloads();
      if (activeTab === 'traffic') loadTraffic();
      if (activeTab === 'products') loadProducts();
      if (activeTab === 'addons') loadAddons();
      if (activeTab === 'settings') loadSiteSettings();
    }
  }, [activeTab, isAuthenticated, adminToken]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Key className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Admin Dashboard</CardTitle>
            <CardDescription>Sign in with your admin credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Enter username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
              />
            </div>
            <Button
              onClick={handleLogin}
              disabled={isLoading || !loginUsername || !loginPassword}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : 'Sign In'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'quiz', label: 'Quiz Data', icon: ClipboardList },
    { key: 'purchases', label: 'Purchases', icon: DollarSign },
    { key: 'downloads', label: 'Downloads', icon: Download },
    { key: 'traffic', label: 'Traffic', icon: Globe },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'addons', label: 'Add-Ons', icon: Package },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-blue-900">Genewell Admin</h1>
            <Button onClick={handleLogout} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setError(''); setSuccess(''); }}
                variant={activeTab === tab.key ? 'default' : 'outline'}
                className={activeTab === tab.key ? 'bg-blue-600' : ''}
                size="sm"
              >
                <Icon className="mr-1 h-4 w-4" /> {tab.label}
              </Button>
            );
          })}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="text-center py-12">
            <Loader className="h-10 w-10 text-blue-600 mx-auto animate-spin" />
            <p className="text-slate-600 mt-3">Loading...</p>
          </div>
        )}

        {activeTab === 'overview' && stats && !isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Users', value: stats.totalUsers, color: 'blue' },
                { label: 'Quiz Attempts', value: stats.totalQuizAttempts, color: 'green' },
                { label: 'Purchases', value: stats.totalPurchases, color: 'purple' },
                { label: 'Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, color: 'orange' },
                { label: 'Downloads', value: stats.totalDownloads, color: 'teal' },
                { label: 'Completed', value: stats.completedPurchases, color: 'emerald' },
              ].map((stat, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Recent Purchases</CardTitle>
                <Button size="sm" variant="outline" onClick={() => handleExportExcel('purchases')}>
                  <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 font-semibold">User</th>
                        <th className="py-2 font-semibold">Email</th>
                        <th className="py-2 font-semibold">Plan</th>
                        <th className="py-2 font-semibold">Amount</th>
                        <th className="py-2 font-semibold">Status</th>
                        <th className="py-2 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPurchases.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-slate-50">
                          <td className="py-2">{p.name || '-'}</td>
                          <td className="py-2 text-slate-600">{p.email}</td>
                          <td className="py-2">{p.plan_id || '-'}</td>
                          <td className="py-2 font-semibold">₹{Number(p.total_price).toLocaleString('en-IN')}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.payment_status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {p.payment_status}
                            </span>
                          </td>
                          <td className="py-2 text-slate-600">{new Date(p.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {recentPurchases.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-500">No purchases yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'users' && !isLoading && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">All Users ({users.length})</CardTitle>
                <CardDescription>Complete user data with contact info</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleExportExcel('users')} className="bg-green-600 hover:bg-green-700">
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 font-semibold">Name</th>
                      <th className="py-2 font-semibold">Email</th>
                      <th className="py-2 font-semibold">Phone</th>
                      <th className="py-2 font-semibold">Age</th>
                      <th className="py-2 font-semibold">Gender</th>
                      <th className="py-2 font-semibold">Location</th>
                      <th className="py-2 font-semibold">Quizzes</th>
                      <th className="py-2 font-semibold">Purchases</th>
                      <th className="py-2 font-semibold">Downloads</th>
                      <th className="py-2 font-semibold">Total Spend</th>
                      <th className="py-2 font-semibold">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-slate-50">
                        <td className="py-2 font-medium">{user.name || '-'}</td>
                        <td className="py-2 text-slate-600">{user.email}</td>
                        <td className="py-2">{user.phone || '-'}</td>
                        <td className="py-2">{user.age || '-'}</td>
                        <td className="py-2 capitalize">{user.gender || '-'}</td>
                        <td className="py-2">{user.location || '-'}</td>
                        <td className="py-2">{user.quiz_count}</td>
                        <td className="py-2">{user.purchase_count}</td>
                        <td className="py-2">{user.download_count}</td>
                        <td className="py-2 font-semibold">₹{Number(user.total_spend).toLocaleString('en-IN')}</td>
                        <td className="py-2 text-slate-600">{new Date(user.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={11} className="py-8 text-center text-slate-500">No users yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'quiz' && !isLoading && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Quiz Submissions ({quizSubmissions.length})</CardTitle>
                <CardDescription>All quiz attempts with complete user data</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleExportExcel('quiz')} className="bg-green-600 hover:bg-green-700">
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 font-semibold">Name</th>
                      <th className="py-2 font-semibold">Email</th>
                      <th className="py-2 font-semibold">Phone</th>
                      <th className="py-2 font-semibold">Age</th>
                      <th className="py-2 font-semibold">Gender</th>
                      <th className="py-2 font-semibold">Location</th>
                      <th className="py-2 font-semibold">Date</th>
                      <th className="py-2 font-semibold">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizSubmissions.map((qs) => (
                      <>
                        <tr key={qs.id} className="border-b hover:bg-slate-50">
                          <td className="py-2 font-medium">{qs.user_name || '-'}</td>
                          <td className="py-2 text-slate-600">{qs.user_email || '-'}</td>
                          <td className="py-2">{qs.user_phone || '-'}</td>
                          <td className="py-2">{qs.user_age || '-'}</td>
                          <td className="py-2 capitalize">{qs.user_gender || '-'}</td>
                          <td className="py-2">{qs.user_location || '-'}</td>
                          <td className="py-2 text-slate-600">{new Date(qs.created_at).toLocaleDateString()}</td>
                          <td className="py-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedQuiz(expandedQuiz === qs.id ? null : qs.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                        {expandedQuiz === qs.id && (
                          <tr key={`${qs.id}-detail`}>
                            <td colSpan={8} className="py-3 px-4 bg-slate-50">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                {Object.entries(qs.quiz_data || {}).map(([key, value]) => (
                                  <div key={key} className="bg-white rounded p-2 border">
                                    <span className="font-semibold text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}: </span>
                                    <span className="text-slate-600">{Array.isArray(value) ? (value as string[]).join(', ') : String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                    {quizSubmissions.length === 0 && (
                      <tr><td colSpan={8} className="py-8 text-center text-slate-500">No quiz submissions yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'purchases' && !isLoading && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">All Purchases ({recentPurchases.length})</CardTitle>
                <CardDescription>Transaction history</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleExportExcel('purchases')} className="bg-green-600 hover:bg-green-700">
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 font-semibold">User</th>
                      <th className="py-2 font-semibold">Email</th>
                      <th className="py-2 font-semibold">Plan</th>
                      <th className="py-2 font-semibold">Amount</th>
                      <th className="py-2 font-semibold">Status</th>
                      <th className="py-2 font-semibold">Date</th>
                      <th className="py-2 font-semibold">Downloads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPurchases.map((p) => {
                      const matchingDownloads = downloads.filter(d => d.user_email === p.email && d.plan_tier === p.plan_id);
                      return (
                      <tr key={p.id} className="border-b hover:bg-slate-50">
                        <td className="py-2">{p.name || '-'}</td>
                        <td className="py-2 text-slate-600">{p.email}</td>
                        <td className="py-2">{p.plan_id || '-'}</td>
                        <td className="py-2 font-semibold">₹{Number(p.total_price).toLocaleString('en-IN')}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.payment_status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {p.payment_status}
                          </span>
                        </td>
                        <td className="py-2 text-slate-600">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="py-2">
                          {matchingDownloads.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              {matchingDownloads.length} PDF{matchingDownloads.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                              None
                            </span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                    {recentPurchases.length === 0 && (
                      <tr><td colSpan={7} className="py-8 text-center text-slate-500">No purchases yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'downloads' && !isLoading && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Product Downloads ({downloads.length})</CardTitle>
                <CardDescription>Track which users downloaded products</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleExportExcel('downloads')} className="bg-green-600 hover:bg-green-700">
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 font-semibold">Email</th>
                      <th className="py-2 font-semibold">Name</th>
                      <th className="py-2 font-semibold">Phone</th>
                      <th className="py-2 font-semibold">Age</th>
                      <th className="py-2 font-semibold">Location</th>
                      <th className="py-2 font-semibold">Product</th>
                      <th className="py-2 font-semibold">Plan</th>
                      <th className="py-2 font-semibold">Email Sent</th>
                      <th className="py-2 font-semibold">Date</th>
                      <th className="py-2 font-semibold">PDF Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downloads.map((d) => (
                      <tr key={d.id} className="border-b hover:bg-slate-50">
                        <td className="py-2 text-slate-600">{d.user_email}</td>
                        <td className="py-2">{d.user_name || '-'}</td>
                        <td className="py-2">{d.phone || '-'}</td>
                        <td className="py-2">{d.age || '-'}</td>
                        <td className="py-2">{d.location || '-'}</td>
                        <td className="py-2">{d.product_name}</td>
                        <td className="py-2 capitalize">{d.plan_tier || '-'}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.email_sent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {d.email_sent ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="py-2 text-slate-600">{new Date(d.created_at).toLocaleDateString()}</td>
                        <td className="py-2">
                          {d.download_url ? (
                            <a
                              href={d.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                            >
                              <Download className="h-3 w-3" /> Download Page
                            </a>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                d.plan_tier === 'premium_blueprint' ? 'bg-green-100 text-green-800' :
                                d.plan_tier === 'essential_blueprint' ? 'bg-blue-100 text-blue-800' :
                                d.plan_tier === 'coaching_blueprint' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {d.plan_tier ? d.plan_tier.replace('_blueprint', '').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) + ' PDF' : 'PDF'}
                              </span>
                              <button
                                onClick={() => handleResendEmail(d.id)}
                                disabled={resendingEmail === d.id}
                                className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center gap-1 disabled:opacity-50"
                              >
                                <Mail className="h-3 w-3" />
                                {resendingEmail === d.id ? 'Sending...' : 'Send Email'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {downloads.length === 0 && (
                      <tr><td colSpan={10} className="py-8 text-center text-slate-500">No downloads yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'traffic' && !isLoading && (
          <div className="space-y-6">
            {trafficDemographics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Total Visits</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{trafficDemographics.totalVisits.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Unique Visitors</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{trafficDemographics.uniqueVisitors.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Today's Visits</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{trafficDemographics.todayTotal.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Today Unique</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{trafficDemographics.todayUnique.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Bot Visits</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{(trafficDemographics.botVisits || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {trafficDemographics && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-600" /> Top Countries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {trafficDemographics.byCountry.length > 0 ? (
                      <div className="space-y-2">
                        {trafficDemographics.byCountry.map((c, i) => (
                          <div key={i} className="flex justify-between items-center py-1 border-b last:border-0">
                            <span className="text-sm font-medium">{c.country}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-slate-100 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(100, (parseInt(c.visits) / trafficDemographics.totalVisits) * 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-600 w-12 text-right">{c.visits}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No data yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-purple-600" /> Top Cities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {trafficDemographics.byCity.length > 0 ? (
                      <div className="space-y-2">
                        {trafficDemographics.byCity.map((c, i) => (
                          <div key={i} className="flex justify-between items-center py-1 border-b last:border-0">
                            <span className="text-sm">
                              <span className="font-medium">{c.city}</span>
                              <span className="text-slate-400 ml-1">({c.region}, {c.country})</span>
                            </span>
                            <span className="text-sm text-slate-600">{c.visits}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No data yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">Visitor Log ({visitors.length})</CardTitle>
                  <CardDescription>Individual visitor records with IP and location</CardDescription>
                </div>
                <Button size="sm" onClick={() => handleExportExcel('traffic')} className="bg-green-600 hover:bg-green-700">
                  <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 font-semibold">IP Address</th>
                        <th className="py-2 font-semibold">Country</th>
                        <th className="py-2 font-semibold">Region</th>
                        <th className="py-2 font-semibold">City</th>
                        <th className="py-2 font-semibold">ISP</th>
                        <th className="py-2 font-semibold">Page</th>
                        <th className="py-2 font-semibold">Bot?</th>
                        <th className="py-2 font-semibold">User Agent</th>
                        <th className="py-2 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitors.map((v) => (
                        <tr key={v.id} className="border-b hover:bg-slate-50">
                          <td className="py-2 font-mono text-xs">{v.ip_address || '-'}</td>
                          <td className="py-2">{v.country || '-'}</td>
                          <td className="py-2">{v.region || '-'}</td>
                          <td className="py-2">{v.city || '-'}</td>
                          <td className="py-2 text-xs">{v.isp || '-'}</td>
                          <td className="py-2">{v.page_visited || '-'}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${v.is_bot ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                              {v.is_bot ? 'Bot' : 'Human'}
                            </span>
                          </td>
                          <td className="py-2 text-xs max-w-[200px] truncate" title={v.user_agent || ''}>{v.user_agent || '-'}</td>
                          <td className="py-2 text-slate-600">{new Date(v.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                      {visitors.length === 0 && (
                        <tr><td colSpan={9} className="py-8 text-center text-slate-500">No visitor data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'products' && !isLoading && (
          <div className="space-y-6">
            {editingProduct && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{editingProduct.id ? 'Edit Product' : 'Add New Product'}</CardTitle>
                  <CardDescription>Fill in the product details below</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Plan ID</Label>
                      <Input
                        value={editingProduct.plan_id || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, plan_id: e.target.value })}
                        placeholder="e.g. basic, pro, premium"
                        disabled={!!editingProduct.id}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={editingProduct.name || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                        placeholder="Product name"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Input
                        value={editingProduct.description || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                        placeholder="Short description"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Details (one per line)</Label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={(editingProduct.details || []).join('\n')}
                        onChange={(e) => setEditingProduct({ ...editingProduct, details: e.target.value.split('\n') })}
                        placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <Input
                        type="number"
                        value={editingProduct.price || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Original Price</Label>
                      <Input
                        type="number"
                        value={editingProduct.original_price || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, original_price: parseFloat(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <Input
                        value={editingProduct.color || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, color: e.target.value })}
                        placeholder="blue"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Icon</Label>
                      <Input
                        value={editingProduct.icon || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, icon: e.target.value })}
                        placeholder="star"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Page Count</Label>
                      <Input
                        type="number"
                        value={editingProduct.page_count || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, page_count: parseInt(e.target.value) })}
                        placeholder="10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Badge</Label>
                      <Input
                        value={editingProduct.badge || ''}
                        onChange={(e) => setEditingProduct({ ...editingProduct, badge: e.target.value })}
                        placeholder="e.g. Best Value"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sort Order</Label>
                      <Input
                        type="number"
                        value={editingProduct.sort_order || 0}
                        onChange={(e) => setEditingProduct({ ...editingProduct, sort_order: parseInt(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2 flex items-end gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingProduct.popular || false}
                          onChange={(e) => setEditingProduct({ ...editingProduct, popular: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium">Popular</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveProduct} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                      {isLoading ? 'Saving...' : editingProduct.id ? 'Update Product' : 'Create Product'}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
                    {editingProduct.id && (
                      <Button variant="destructive" onClick={() => handleDeleteProduct(editingProduct.id!)} disabled={isLoading}>
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">Managed Products ({managedProducts.length})</CardTitle>
                  <CardDescription>Changes reflect on the Pricing page immediately after saving</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadProducts()} disabled={isLoading}>
                    {isLoading ? '...' : '↻ Refresh'}
                  </Button>
                  <Button size="sm" onClick={() => setEditingProduct({ visible: true, popular: false, sort_order: 0, price: 0, details: [] })} className="bg-blue-600 hover:bg-blue-700">
                    + Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 font-semibold">Name</th>
                        <th className="py-2 font-semibold">Price</th>
                        <th className="py-2 font-semibold">Original Price</th>
                        <th className="py-2 font-semibold">Badge</th>
                        <th className="py-2 font-semibold">Visible</th>
                        <th className="py-2 font-semibold">Popular</th>
                        <th className="py-2 font-semibold">Sort Order</th>
                        <th className="py-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managedProducts.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-slate-50">
                          <td className="py-2 font-medium">{p.name}</td>
                          <td className="py-2">₹{Number(p.price).toLocaleString('en-IN')}</td>
                          <td className="py-2 text-slate-500">{p.original_price ? `₹${Number(p.original_price).toLocaleString('en-IN')}` : '-'}</td>
                          <td className="py-2">
                            {p.badge ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">{p.badge}</span>
                            ) : '-'}
                          </td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.visible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {p.visible ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.popular ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                              {p.popular ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="py-2">{p.sort_order}</td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setEditingProduct({ ...p, details: Array.isArray(p.details) ? p.details : JSON.parse(p.details as any || '[]') })}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleToggleVisibility(p.id)}>
                                {p.visible ? '🙈' : '👁️'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {managedProducts.length === 0 && (
                        <tr><td colSpan={8} className="py-8 text-center text-slate-500">No products yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'addons' && !isLoading && (
          <div className="space-y-6">
            {editingAddon && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{editingAddon.id ? 'Edit Add-On' : 'Create New Add-On'}</CardTitle>
                  <CardDescription>Prices must be between ₹99 and ₹399</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Add-On ID</Label>
                      <Input
                        value={editingAddon.addon_id || ''}
                        onChange={(e) => setEditingAddon({ ...editingAddon, addon_id: e.target.value })}
                        placeholder="e.g. addon_dna"
                        disabled={!!editingAddon.id}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={editingAddon.name || ''}
                        onChange={(e) => setEditingAddon({ ...editingAddon, name: e.target.value })}
                        placeholder="Add-on name"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Input
                        value={editingAddon.description || ''}
                        onChange={(e) => setEditingAddon({ ...editingAddon, description: e.target.value })}
                        placeholder="Short description"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Features (one per line)</Label>
                      <textarea
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={(editingAddon.features || []).join('\n')}
                        onChange={(e) => setEditingAddon({ ...editingAddon, features: e.target.value.split('\n') })}
                        placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price (₹99–₹399)</Label>
                      <Input
                        type="number"
                        min={99}
                        max={399}
                        value={editingAddon.price || ''}
                        onChange={(e) => setEditingAddon({ ...editingAddon, price: parseFloat(e.target.value) })}
                        placeholder="149"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Original Price</Label>
                      <Input
                        type="number"
                        value={editingAddon.original_price || ''}
                        onChange={(e) => setEditingAddon({ ...editingAddon, original_price: parseFloat(e.target.value) })}
                        placeholder="299"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Icon</Label>
                      <Input
                        value={editingAddon.icon || ''}
                        onChange={(e) => setEditingAddon({ ...editingAddon, icon: e.target.value })}
                        placeholder="star"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Page Count Addition</Label>
                      <Input
                        type="number"
                        value={editingAddon.page_count_addition || ''}
                        onChange={(e) => setEditingAddon({ ...editingAddon, page_count_addition: parseInt(e.target.value) })}
                        placeholder="2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sort Order</Label>
                      <Input
                        type="number"
                        value={editingAddon.sort_order || 0}
                        onChange={(e) => setEditingAddon({ ...editingAddon, sort_order: parseInt(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2 flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingAddon.visible !== false}
                          onChange={(e) => setEditingAddon({ ...editingAddon, visible: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium">Visible on site</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveAddon} disabled={isLoading} className="bg-purple-600 hover:bg-purple-700">
                      {isLoading ? 'Saving...' : editingAddon.id ? 'Update Add-On' : 'Create Add-On'}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingAddon(null)}>Cancel</Button>
                    {editingAddon.id && (
                      <Button variant="destructive" onClick={() => handleDeleteAddon(editingAddon.id!)} disabled={isLoading}>
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">Premium Add-Ons ({managedAddons.length})</CardTitle>
                  <CardDescription>All prices enforced ₹99–₹399 only</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadAddons()} disabled={isLoading}>
                    {isLoading ? '...' : '↻ Refresh'}
                  </Button>
                  <Button size="sm" onClick={() => setEditingAddon({ visible: true, sort_order: 0, price: 149, features: [] })} className="bg-purple-600 hover:bg-purple-700">
                    + Add New Add-On
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 font-semibold">Name</th>
                        <th className="py-2 font-semibold">Price</th>
                        <th className="py-2 font-semibold">Original Price</th>
                        <th className="py-2 font-semibold">Pages Added</th>
                        <th className="py-2 font-semibold">Visible</th>
                        <th className="py-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managedAddons.map((a) => (
                        <tr key={a.id} className="border-b hover:bg-slate-50">
                          <td className="py-2 font-medium">{a.name}</td>
                          <td className="py-2 font-semibold text-purple-700">₹{Number(a.price).toLocaleString('en-IN')}</td>
                          <td className="py-2 text-slate-400 line-through">{a.original_price ? `₹${Number(a.original_price).toLocaleString('en-IN')}` : '-'}</td>
                          <td className="py-2">+{a.page_count_addition}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.visible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {a.visible ? 'Visible' : 'Hidden'}
                            </span>
                          </td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setEditingAddon({ ...a, features: Array.isArray(a.features) ? a.features : JSON.parse(a.features as any || '[]') })}>
                                Edit
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleToggleAddonVisibility(a.id)}>
                                {a.visible ? '🙈' : '👁️'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {managedAddons.length === 0 && (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-500">No add-ons yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'settings' && !isLoading && (
          <div className="space-y-6">

            {/* SITE CONTENT SETTINGS */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-600" /> Website Content Settings
                </CardTitle>
                <CardDescription>Edit what appears on the live website — changes take effect immediately</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="font-semibold text-purple-700">🏠 Pricing Page</Label>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Pricing Page Headline</Label>
                    <Input value={settingsDraft['pricing_headline'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, pricing_headline: e.target.value })} placeholder="Evidence-Based Wellness, Every Budget" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Pricing Page Subheadline</Label>
                    <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={settingsDraft['pricing_subheadline'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, pricing_subheadline: e.target.value })} placeholder="Science-backed plans..." />
                  </div>

                  <div className="space-y-2 md:col-span-2 pt-2 border-t">
                    <Label className="font-semibold text-purple-700">🎁 Launch Banner</Label>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={settingsDraft['banner_enabled'] === 'true'} onChange={(e) => setSettingsDraft({ ...settingsDraft, banner_enabled: e.target.checked ? 'true' : 'false' })} className="rounded border-gray-300" />
                      <span className="text-sm font-medium">Show Launch Banner on Pricing Page</span>
                    </label>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Banner Title</Label>
                    <Input value={settingsDraft['banner_title'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, banner_title: e.target.value })} placeholder="🚀 45-Day Launch Offer!" />
                  </div>
                  <div className="space-y-2">
                    <Label>Banner Subtitle (highlighted text)</Label>
                    <Input value={settingsDraft['banner_subtitle'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, banner_subtitle: e.target.value })} placeholder="All premium products are FREE for 45 days" />
                  </div>
                  <div className="space-y-2">
                    <Label>Banner Exception Text</Label>
                    <Input value={settingsDraft['banner_exception'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, banner_exception: e.target.value })} placeholder="Live Training & Coaching services available as paid add-ons" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Banner Body Text</Label>
                    <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={settingsDraft['banner_body'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, banner_body: e.target.value })} />
                  </div>

                  <div className="space-y-2 md:col-span-2 pt-2 border-t">
                    <Label className="font-semibold text-purple-700">🏠 Homepage (Landing Page)</Label>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Homepage Hero Headline</Label>
                    <Input value={settingsDraft['home_hero_headline'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, home_hero_headline: e.target.value })} placeholder="Your Personalized Wellness Blueprint" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Homepage Hero Subtext</Label>
                    <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={settingsDraft['home_hero_subtext'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, home_hero_subtext: e.target.value })} placeholder="Science-backed wellness plans tailored to your body..." />
                  </div>
                  <div className="space-y-2">
                    <Label>CTA Button Text</Label>
                    <Input value={settingsDraft['home_cta_text'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, home_cta_text: e.target.value })} placeholder="Get My Free Blueprint" />
                  </div>
                  <div className="space-y-2">
                    <Label>CTA Sub-text (below button)</Label>
                    <Input value={settingsDraft['home_cta_subtext'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, home_cta_subtext: e.target.value })} placeholder="Free for limited time — No credit card required" />
                  </div>

                  <div className="space-y-2 md:col-span-2 pt-2 border-t">
                    <Label className="font-semibold text-purple-700">📋 Quiz Page</Label>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Quiz Page Headline</Label>
                    <Input value={settingsDraft['quiz_headline'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, quiz_headline: e.target.value })} placeholder="Your Personalized Wellness Assessment" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Quiz Page Description</Label>
                    <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={settingsDraft['quiz_description'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, quiz_description: e.target.value })} placeholder="Answer a few questions to get your personalized wellness report..." />
                  </div>

                  <div className="space-y-2 md:col-span-2 pt-2 border-t">
                    <Label className="font-semibold text-purple-700">ℹ️ About / Brand Section</Label>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Brand Tagline</Label>
                    <Input value={settingsDraft['brand_tagline'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, brand_tagline: e.target.value })} placeholder="Evidence-based wellness for every Indian" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>About Us Text</Label>
                    <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={settingsDraft['about_text'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, about_text: e.target.value })} placeholder="Genewell creates personalized wellness blueprints using peer-reviewed research..." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Disclaimer / Terms Note (shown on reports)</Label>
                    <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={settingsDraft['disclaimer_text'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, disclaimer_text: e.target.value })} placeholder="This report is for educational purposes only..." />
                  </div>

                  <div className="space-y-2 md:col-span-2 pt-2 border-t">
                    <Label className="font-semibold text-purple-700">📞 Contact & Social</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Site / Brand Name</Label>
                    <Input value={settingsDraft['site_name'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, site_name: e.target.value })} placeholder="Genewell" />
                  </div>
                  <div className="space-y-2">
                    <Label>Support Email</Label>
                    <Input value={settingsDraft['contact_email'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, contact_email: e.target.value })} placeholder="support@genewell.in" />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp Number</Label>
                    <Input value={settingsDraft['contact_whatsapp'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, contact_whatsapp: e.target.value })} placeholder="+919876543210" />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram URL</Label>
                    <Input value={settingsDraft['social_instagram'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, social_instagram: e.target.value })} placeholder="https://instagram.com/genewell" />
                  </div>
                  <div className="space-y-2">
                    <Label>YouTube URL</Label>
                    <Input value={settingsDraft['social_youtube'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, social_youtube: e.target.value })} placeholder="https://youtube.com/@genewell" />
                  </div>
                  <div className="space-y-2">
                    <Label>Twitter/X URL</Label>
                    <Input value={settingsDraft['social_twitter'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, social_twitter: e.target.value })} placeholder="https://x.com/genewell" />
                  </div>

                  <div className="space-y-2 md:col-span-2 pt-2 border-t">
                    <Label className="font-semibold text-purple-700">📦 Footer</Label>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Footer Tagline</Label>
                    <Input value={settingsDraft['footer_tagline'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, footer_tagline: e.target.value })} placeholder="© 2026 Genewell. All rights reserved." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Privacy Policy URL</Label>
                    <Input value={settingsDraft['privacy_policy_url'] || ''} onChange={(e) => setSettingsDraft({ ...settingsDraft, privacy_policy_url: e.target.value })} placeholder="https://genewell.in/privacy" />
                  </div>
                </div>
                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={handleSaveSiteSettings} disabled={settingsSaving} className="bg-blue-600 hover:bg-blue-700">
                    {settingsSaving ? 'Saving...' : '💾 Save All Site Settings'}
                  </Button>
                  <Button variant="outline" onClick={() => setSettingsDraft({ ...siteSettings })}>Reset Changes</Button>
                </div>
              </CardContent>
            </Card>

          <div className="max-w-md mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" /> Admin Username
                </CardTitle>
                <CardDescription>Your current admin username</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={adminUsername || 'admin'}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="h-5 w-5" /> Change Admin Password
                </CardTitle>
                <CardDescription>Update your admin login password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" /> System Info
                </CardTitle>
                <CardDescription>System and database status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium text-slate-700">Database Connection</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Connected</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium text-slate-700">Database Type</span>
                    <span className="text-sm text-slate-600">PostgreSQL (Neon)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" /> Export All Data
                </CardTitle>
                <CardDescription>Download data as Excel files</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {['users', 'quiz', 'purchases', 'downloads', 'traffic'].map((type) => (
                  <Button
                    key={type}
                    onClick={() => handleExportExcel(type)}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export {type.charAt(0).toUpperCase() + type.slice(1)} Data
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
