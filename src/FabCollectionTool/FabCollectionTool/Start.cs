using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace FabCollectionTool
{
    internal class Start
    {
        public static void ShowMainMenu()
        {
            Console.Write("Select: [p]arse ods to csv, [e]xit: ");
            string selection = Console.ReadKey().KeyChar.ToString().ToLower();
            Console.WriteLine();

            switch (selection)
            {
                case "e":
                    Environment.Exit(0);
                    break;

                case "p":
                    ParseOdsToCsv.ShowMenu();
                    break;

                default:
                    ShowMainMenu();
                    break;
            }
        }
    }
}
