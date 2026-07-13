import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import PaymentsIcon from '@mui/icons-material/Payments';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import { useAuth } from '../hooks/useAuth';

const SIDEBAR_WIDTH = 240;

/**
 * 主布局组件：侧边导航 + 顶部栏 + 内容区域
 * 使用纯 flex 布局，不用 MUI Drawer，避免 position: fixed 导致遮挡
 */
export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const sidebarContent = (
    <Box>
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="subtitle1" fontWeight={600} noWrap>
          合同跟踪平台
        </Typography>
      </Box>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton
            selected={location.pathname === '/'}
            onClick={() => navigate('/')}
          >
            <ListItemIcon>
              <HomeOutlinedIcon />
            </ListItemIcon>
            <ListItemText primary="首页" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            selected={isActive('/contracts')}
            onClick={() => navigate('/contracts')}
          >
            <ListItemIcon>
              <DescriptionIcon />
            </ListItemIcon>
            <ListItemText primary="合同列表" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            selected={isActive('/payments')}
            onClick={() => navigate('/payments')}
          >
            <ListItemIcon>
              <PaymentsIcon />
            </ListItemIcon>
            <ListItemText primary="回款跟踪" />
          </ListItemButton>
        </ListItem>
        {user?.role === 'admin' && (
          <ListItem disablePadding>
            <ListItemButton
              selected={isActive('/users')}
              onClick={() => navigate('/users')}
            >
              <ListItemIcon>
                <PeopleIcon />
              </ListItemIcon>
              <ListItemText primary="用户管理" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      {/* ============ 桌面端侧边栏 ============ */}
      <Box
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          display: { xs: 'none', md: 'block' },
          height: '100vh',
          position: 'sticky',
          top: 0,
          overflow: 'auto',
        }}
      >
        {sidebarContent}
      </Box>

      {/* ============ 移动端侧边栏（遮罩式） ============ */}
      {mobileOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 1200,
          }}
        >
          {/* 遮罩层 */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
            onClick={() => setMobileOpen(false)}
          />
          {/* 侧边栏面板 */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: SIDEBAR_WIDTH,
              height: '100vh',
              backgroundColor: 'background.paper',
              zIndex: 1,
              overflow: 'auto',
            }}
          >
            {sidebarContent}
          </Box>
        </Box>
      )}

      {/* ============ 右侧主区域 ============ */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* 顶部栏 */}
        <AppBar position="sticky" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
              合同执行情况跟踪共享平台
            </Typography>
            <Button color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout} size="small">
              退出
            </Button>
          </Toolbar>
        </AppBar>

        {/* 内容区 */}
        <Box
          component="main"
          sx={{
            flex: 1,
            p: 3,
            backgroundColor: '#f5f5f5',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
