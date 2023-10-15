namespace FabCollectionTool
{
    internal class Start
    {
        public static void ShowMainMenu()
        {
            Console.Write("Select: [p]arse .ods file, [e]xit: ");
            string selection = Console.ReadKey().KeyChar.ToString().ToLower();
            Console.WriteLine();

            switch (selection)
            {
                case "e":
                    Environment.Exit(0);
                    break;

                case "p":
                    ParseOds.ShowMenu();
                    break;

                default:
                    ShowMainMenu();
                    break;
            }
        }
    }
}
