import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Chip,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import client from '../api/client';
import type { ApiResponse } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';

interface UserItem {
  id: number;
  username: string;
  display_name: string;
  role: string;
  created_at: string;
}

export default function UserManagePage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create user state
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState('sales');

  // Delete user state
  const [deleteConfirm, setDeleteConfirm] = useState<UserItem | null>(null);

  const fetchUsers = async () => {
    try {
      const { data } = await client.get<ApiResponse<UserItem[]>>('/users');
      setUsers(data.data);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || '获取用户列表失败' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleEditSubmit = async () => {
    if (!selectedUser) return;
    try {
      await client.put(`/users/${selectedUser.id}`, { display_name: newName });
      setMsg({ type: 'success', text: '昵称修改成功' });
      setEditOpen(false);
      fetchUsers();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || '修改失败' });
    }
  };

  const handlePwdSubmit = async () => {
    if (!selectedUser) return;
    try {
      await client.put(`/users/${selectedUser.id}/password`, { password: newPassword });
      setMsg({ type: 'success', text: '密码修改成功' });
      setPwdOpen(false);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || '修改失败' });
    }
  };

  const handleCreate = async () => {
    try {
      await client.post('/users', { username: newUsername, password: newPwd, display_name: newDisplayName, role: newRole });
      setMsg({ type: 'success', text: '用户创建成功' });
      setCreateOpen(false);
      setNewUsername(''); setNewPwd(''); setNewDisplayName(''); setNewRole('sales');
      fetchUsers();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || '创建失败' });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await client.delete(`/users/${deleteConfirm.id}`);
      setMsg({ type: 'success', text: '用户已删除' });
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || '删除失败' });
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>用户管理</Typography>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ mb: 2 }}>新增用户</Button>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>用户名</TableCell>
              <TableCell>昵称</TableCell>
              <TableCell>角色</TableCell>
              <TableCell>创建时间</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>{u.id}</TableCell>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.display_name}</TableCell>
                <TableCell><Chip size="small" label={u.role === 'admin' ? '管理员' : '业务员'} color={u.role === 'admin' ? 'primary' : 'default'} /></TableCell>
                <TableCell>{u.created_at}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => { setSelectedUser(u); setNewName(u.display_name); setEditOpen(true); }}>改昵称</Button>
                  <Button size="small" color="warning" sx={{ ml: 1 }} onClick={() => { setSelectedUser(u); setNewPassword(''); setPwdOpen(true); }}>改密码</Button>
                  <Button size="small" color="error" sx={{ ml: 1 }} onClick={() => setDeleteConfirm(u)}>删除</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 新增用户对话框 */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>新增用户</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="用户名" value={newUsername}
              onChange={e => setNewUsername(e.target.value)} required />
            <TextField fullWidth type="password" label="密码（至少6位）" value={newPwd}
              onChange={e => setNewPwd(e.target.value)} required />
            <TextField fullWidth label="昵称" value={newDisplayName}
              onChange={e => setNewDisplayName(e.target.value)} required />
            <FormControl fullWidth>
              <InputLabel>角色</InputLabel>
              <Select value={newRole} label="角色" onChange={e => setNewRole(e.target.value)}>
                <MenuItem value="admin">管理员</MenuItem>
                <MenuItem value="sales">业务员</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreate}
            disabled={!newUsername || !newPwd || !newDisplayName || newPwd.length < 6}>
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* 改昵称对话框 */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>修改昵称 - {selectedUser?.username}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="昵称" value={newName} onChange={e => setNewName(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleEditSubmit}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* 改密码对话框 */}
      <Dialog open={pwdOpen} onClose={() => setPwdOpen(false)}>
        <DialogTitle>修改密码 - {selectedUser?.username}</DialogTitle>
        <DialogContent>
          <TextField fullWidth type="password" label="新密码（至少6位）" value={newPassword} onChange={e => setNewPassword(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwdOpen(false)}>取消</Button>
          <Button variant="contained" color="warning" onClick={handlePwdSubmit}>确认修改</Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <ConfirmDialog open={!!deleteConfirm} title="确认删除"
        content={`确定删除用户 "${deleteConfirm?.username}"（${deleteConfirm?.display_name}）？此操作不可撤销。`}
        onConfirm={handleDelete} onCancel={() => setDeleteConfirm(null)} danger />
    </Box>
  );
}
