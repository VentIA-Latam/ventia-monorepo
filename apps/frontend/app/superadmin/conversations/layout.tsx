export default function SuperAdminConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-3 sm:-mx-4 md:-mx-6 lg:-mx-12 xl:-mx-16 -my-4 md:-my-6 flex-1 flex flex-col min-h-0 overflow-hidden">
      {children}
    </div>
  );
}
