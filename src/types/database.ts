export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      perfiles: {
        Row: {
          id: string;
          correo: string;
          rol: 'admin' | 'cliente';
          estado: 'pendiente' | 'activo' | 'inactivo';
          fecha_creacion: string;
        };
        Insert: {
          id: string;
          correo: string;
          rol?: 'admin' | 'cliente';
          estado?: 'pendiente' | 'activo' | 'inactivo';
          fecha_creacion?: string;
        };
        Update: {
          correo?: string;
          rol?: 'admin' | 'cliente';
          estado?: 'pendiente' | 'activo' | 'inactivo';
        };
        Relationships: [];
      };
      clientes: {
        Row: {
          id: number;
          id_usuario: string;
          nombre: string;
          apellido: string;
          fecha_creacion: string;
        };
        Insert: {
          id?: number;
          id_usuario: string;
          nombre: string;
          apellido: string;
          fecha_creacion?: string;
        };
        Update: {
          nombre?: string;
          apellido?: string;
        };
        Relationships: [];
      };
      productos: {
        Row: {
          id: number;
          nombre: string;
          descripcion: string;
          valor_unitario: number;
          stock: number;
        };
        Insert: {
          id?: number;
          nombre: string;
          descripcion: string;
          valor_unitario: number;
          stock?: number;
        };
        Update: {
          nombre?: string;
          descripcion?: string;
          valor_unitario?: number;
          stock?: number;
        };
        Relationships: [];
      };
      encabezados: {
        Row: {
          id: number;
          id_cliente: number;
          fecha: string;
          total: number;
        };
        Insert: { id?: number; id_cliente: number; fecha?: string; total?: number };
        Update: { id_cliente?: number; fecha?: string; total?: number };
        Relationships: [];
      };
      detalles: {
        Row: {
          id: number;
          id_encabezado: number;
          id_producto: number;
          cantidad: number;
          precio_unitario: number;
          valor: number;
        };
        Insert: {
          id?: number;
          id_encabezado: number;
          id_producto: number;
          cantidad: number;
          precio_unitario: number;
          valor?: number;
        };
        Update: { cantidad?: number; precio_unitario?: number };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      crear_compra: {
        Args: { p_items: Json; p_cliente_id?: number | null };
        Returns: number;
      };
      eliminar_compra: { Args: { p_compra_id: number }; Returns: undefined };
      actualizar_cantidad_detalle: {
        Args: { p_detalle_id: number; p_nueva_cantidad: number };
        Returns: undefined;
      };
      agregar_detalle_compra: {
        Args: { p_compra_id: number; p_producto_id: number; p_cantidad: number };
        Returns: number;
      };
      eliminar_detalle_compra: { Args: { p_detalle_id: number }; Returns: undefined };
      eliminar_cuenta_cliente: { Args: { p_usuario_id: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
